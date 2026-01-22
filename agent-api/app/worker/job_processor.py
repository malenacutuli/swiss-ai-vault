"""Job processor for agent execution"""
import logging
from typing import Tuple
from supabase import create_client, Client
from anthropic import Anthropic
from app.config import get_settings
from app.agent.planner import AgentPlanner
from app.agent.supervisor import AgentSupervisor
from app.agent.models.types import ExecutionResult
from app.worker.e2b_agent_executor import E2BAgentExecutor

logger = logging.getLogger(__name__)


class JobProcessor:
    """
    Processes agent execution jobs.

    Hybrid Architecture:
    - Use E2B executor for all external API calls (reliable networking)
    - Fallback to direct execution if E2B unavailable (for testing)
    """

    def __init__(self):
        settings = get_settings()

        # Use direct execution with AgentSupervisor (K8s DNS is fixed)
        # Tools (shell, code) still use E2B via ToolRouter
        logger.info("Using direct execution with AgentSupervisor")
        logger.info("Tools (shell/code) will execute in E2B sandboxes via ToolRouter")
        self.use_e2b = False

        # Initialize Supabase and Anthropic for direct execution
        try:
            self.supabase: Client = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key
            )
            self.anthropic = Anthropic(api_key=settings.anthropic_api_key)
            logger.info("✓ Supabase and Anthropic clients initialized")
        except Exception as e:
            logger.error(f"Failed to initialize clients: {e}")
            self.supabase = None
            self.anthropic = None

        # Store settings
        self.settings = settings

        logger.info("✓ Job processor initialized - AgentSupervisor with E2B tools")

    async def process(self, job: dict) -> Tuple[bool, str]:
        """
        Process an agent execution job.

        Args:
            job: Job data dictionary with run_id

        Returns:
            Tuple of (success, error_message)
        """
        run_id = job["run_id"]
        retry_count = job.get("retry_count", 0)

        logger.info(f"Processing job {run_id} (retry={retry_count})")

        # Use E2B executor if available (reliable networking)
        if self.use_e2b:
            return await self._process_with_e2b(run_id)
        else:
            # Fallback to direct execution (may fail due to DNS)
            return await self._process_direct(run_id)

    async def _process_with_e2b(self, run_id: str) -> Tuple[bool, str]:
        """Process job using E2B executor (all API calls inside sandbox)"""
        logger.info(f"Processing {run_id} with E2B executor (hybrid architecture)")

        try:
            # Execute entire agent loop inside E2B sandbox
            result = await self.e2b_executor.execute_agent_run(
                run_id=run_id,
                api_keys={
                    "SUPABASE_URL": self.settings.supabase_url,
                    "SUPABASE_SERVICE_ROLE_KEY": self.settings.supabase_service_role_key,
                    "ANTHROPIC_API_KEY": self.settings.anthropic_api_key,
                }
            )

            if result["status"] == "completed":
                logger.info(f"Job {run_id} completed successfully via E2B")
                return True, None
            elif result["status"] in ["waiting_user", "paused"]:
                logger.info(f"Job {run_id} status: {result['status']}")
                return True, None
            else:  # failed
                error = result.get("error", "Unknown error")
                logger.error(f"Job {run_id} failed via E2B: {error}")
                return False, error

        except Exception as e:
            error = f"E2B execution exception: {str(e)}"
            logger.exception(error)
            return False, error

    async def _process_direct(self, run_id: str) -> Tuple[bool, str]:
        """Fallback: Process job with direct API calls (may fail due to DNS)"""
        logger.warning(f"Processing {run_id} with direct execution (DNS may fail)")

        if not self.supabase or not self.anthropic:
            return False, "Direct execution clients not initialized"

        try:
            # Fetch run details (DNS call - may fail)
            run_response = self.supabase.table("agent_runs").select("*").eq("id", run_id).execute()

            if not run_response.data:
                error = f"Run {run_id} not found"
                logger.error(error)
                return False, error

            run = run_response.data[0]
            user_id = run["user_id"]
            prompt = run["prompt"]

            # Phase 1: Planning (DNS call - may fail)
            logger.info(f"Starting planning phase for run {run_id}")
            self.supabase.table("agent_runs").update({
                "status": "planning"
            }).eq("id", run_id).execute()

            planner = AgentPlanner(self.supabase, user_id, self.anthropic)
            plan, plan_error = await planner.create_plan(prompt)

            if not plan or plan_error:
                error = f"Planning failed: {plan_error}"
                logger.error(error)
                self.supabase.table("agent_runs").update({
                    "status": "failed",
                    "error_message": error,
                    "completed_at": "now()"
                }).eq("id", run_id).execute()
                return False, error

            # Save plan
            self.supabase.table("agent_runs").update({
                "plan": plan.dict(),
                "plan_version": 1
            }).eq("id", run_id).execute()

            logger.info(
                f"Planning completed for run {run_id}: "
                f"{len(plan.phases)} phases, {plan.total_estimated_credits} credits"
            )

            # Note: Initial user message already inserted by handle_create in API
            # No need to insert it again here

            # Phase 2: Execution (DNS calls - may fail)
            logger.info(f"Starting execution phase for run {run_id}")

            supervisor = AgentSupervisor(
                supabase=self.supabase,
                run_id=run_id,
                user_id=user_id,
                plan=plan,
                current_phase_number=1
            )

            result: ExecutionResult = await supervisor.execute()

            # Update final status
            if result.status == "completed":
                self.supabase.table("agent_runs").update({
                    "status": "completed",
                    "completed_at": "now()"
                }).eq("id", run_id).execute()

                logger.info(f"Job {run_id} completed successfully (direct execution)")
                return True, None

            elif result.status == "waiting_user":
                logger.info(f"Job {run_id} waiting for user input")
                return True, None  # Not an error, waiting for user

            elif result.status == "paused":
                logger.info(f"Job {run_id} paused")
                return True, None  # Not an error, paused

            else:  # failed
                error = result.error or "Execution failed"
                logger.error(f"Job {run_id} failed: {error}")
                return False, error

        except Exception as e:
            error = f"Direct execution exception (likely DNS): {str(e)}"
            logger.exception(error)

            # Mark run as failed
            try:
                self.supabase.table("agent_runs").update({
                    "status": "failed",
                    "error_message": str(e),
                    "completed_at": "now()"
                }).eq("id", run_id).execute()
            except Exception as update_error:
                logger.error(f"Failed to update run status: {update_error}")

            return False, error
