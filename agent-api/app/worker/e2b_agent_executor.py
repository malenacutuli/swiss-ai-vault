"""
E2B Agent Executor - Runs entire agent loop inside E2B sandbox

This is the correct hybrid architecture (SwissBrain standard):
- Worker (K8s): Receives jobs, spawns E2B sandboxes, updates Redis
- E2B Sandbox: Makes ALL external API calls (LLM, Supabase, etc.)

Why: K8s pods have unreliable DNS/networking. E2B sandboxes have reliable networking.
"""
import logging
import os
import json
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class E2BAgentExecutor:
    """
    Execute the entire agent loop inside E2B sandbox.

    Architecture:
    1. Worker receives job from Redis queue (K8s)
    2. Worker spawns E2B sandbox
    3. E2B sandbox makes ALL external API calls:
       - Anthropic LLM (planning, execution)
       - Supabase (fetch/update runs, logs)
       - Any other external APIs
    4. E2B sandbox returns results
    5. Worker updates Redis/Supabase with final results
    """

    def __init__(self):
        self.e2b_api_key = os.environ.get('E2B_API_KEY')
        self.e2b_available = False

        # Try to import E2B
        try:
            from e2b_code_interpreter import Sandbox
            self.Sandbox = Sandbox
            self.e2b_available = True
            logger.info("✓ E2B Code Interpreter available")
        except ImportError as e:
            logger.error(f"✗ E2B Code Interpreter NOT available: {e}")
            logger.error("Install with: pip install e2b-code-interpreter")
            self.Sandbox = None

        # Check API key
        if not self.e2b_api_key:
            logger.warning("! E2B_API_KEY not set - executor will fail")
            self.e2b_available = False
        elif self.e2b_available:
            logger.info(f"✓ E2B API key configured: {self.e2b_api_key[:10]}...")

    async def execute_agent_run(
        self,
        run_id: str,
        api_keys: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Execute entire agent run inside E2B sandbox.

        Args:
            run_id: Agent run ID
            api_keys: Dictionary with all required API keys:
                - SUPABASE_URL
                - SUPABASE_SERVICE_ROLE_KEY
                - ANTHROPIC_API_KEY

        Returns:
            {
                "status": "completed" | "failed" | "waiting_user",
                "error": str | None,
                "output": dict | None
            }
        """
        if not self.e2b_available:
            return {
                "status": "failed",
                "error": "E2B not available - check package installation and API key",
                "output": None
            }

        logger.info(f"Creating E2B sandbox for run {run_id}...")

        try:
            # Create sandbox using E2B's create() method
            # E2B_API_KEY env var is automatically read from environment
            sandbox = self.Sandbox.create()

            try:
                # Install dependencies inside sandbox
                logger.info("Installing dependencies in E2B sandbox...")
                install_result = sandbox.run_code("""
import subprocess
import sys

packages = ['anthropic', 'supabase', 'pydantic']
for package in packages:
    print(f"Installing {package}...")
    subprocess.run([sys.executable, '-m', 'pip', 'install', package],
                   capture_output=True, check=True)
print("All packages installed successfully")
""")

                if install_result.error:
                    logger.error(f"Failed to install dependencies: {install_result.error}")
                    return {
                        "status": "failed",
                        "error": f"Dependency installation failed: {install_result.error}",
                        "output": None
                    }

                logger.info(f"Dependencies installed: {install_result.logs.stdout}")

                # Set environment variables in sandbox
                logger.info("Setting environment variables in sandbox...")
                for key, value in api_keys.items():
                    # Escape single quotes in value
                    safe_value = value.replace("'", "\\'")
                    sandbox.run_code(f"import os; os.environ['{key}'] = '{safe_value}'")

                # Execute agent loop inside sandbox
                logger.info(f"Executing agent loop for run {run_id} inside E2B...")

                agent_code = f"""
import os
import json
import asyncio
from datetime import datetime
from supabase import create_client
from anthropic import Anthropic
from app.agent.planner import AgentPlanner
from app.agent.supervisor import AgentSupervisor

# Initialize clients (networking happens inside E2B where it's reliable)
supabase = create_client(
    os.environ['SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY']
)
anthropic = Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])

run_id = "{run_id}"

async def execute_agent():
    try:
        # Fetch run details from Supabase
        print(f"Fetching run {{run_id}} from Supabase...")
        run_response = supabase.table("agent_runs").select("*").eq("id", run_id).single().execute()

        if not run_response.data:
            print(json.dumps({{"status": "failed", "error": "Run not found"}}))
            return

        run = run_response.data
        prompt = run["prompt"]
        user_id = run["user_id"]

        print(f"Run found. Prompt: {{prompt[:100]}}...")

        # Update status to planning
        supabase.table("agent_runs").update({{"status": "planning"}}).eq("id", run_id).execute()

        # Phase 1: Planning with AgentPlanner
        print("Creating execution plan with AgentPlanner...")
        planner = AgentPlanner(supabase, user_id, anthropic)
        plan, error = await planner.create_plan(prompt)

        if not plan:
            error_msg = f"Planning failed: {{error}}"
            print(f"ERROR: {{error_msg}}")
            supabase.table("agent_runs").update({{
                "status": "failed",
                "error_message": error_msg,
                "completed_at": datetime.utcnow().isoformat()
            }}).eq("id", run_id).execute()
            print(json.dumps({{"status": "failed", "error": error_msg, "output": None}}))
            return

        print(f"Planning completed. Goal: {{plan.goal}}")
        print(f"Phases: {{len(plan.phases)}}")

        # Save plan to Supabase
        supabase.table("agent_runs").update({{
            "plan": plan.dict(),
            "plan_version": 1
        }}).eq("id", run_id).execute()

        # Phase 2: Execution with AgentSupervisor (calls actual tools!)
        print("Executing plan with AgentSupervisor...")
        supervisor = AgentSupervisor(
            supabase=supabase,
            anthropic=anthropic,
            run_id=run_id,
            user_id=user_id,
            plan=plan,
            current_phase_number=1
        )

        result = await supervisor.execute()

        print(f"Execution completed. Status: {{result.status}}")

        # Return result
        print(json.dumps({{
            "status": result.status,
            "error": result.error,
            "output": {{"final_message": result.final_message}}
        }}))

    except Exception as e:
        import traceback
        error_msg = str(e)
        error_trace = traceback.format_exc()
        print(f"ERROR: {{error_msg}}")
        print(f"TRACEBACK: {{error_trace}}")

        # Update run status to failed
        try:
            supabase.table("agent_runs").update({{
                "status": "failed",
                "error_message": error_msg,
                "completed_at": datetime.utcnow().isoformat()
            }}).eq("id", run_id).execute()
        except:
            pass

        print(json.dumps({{
            "status": "failed",
            "error": error_msg,
            "output": None
        }}))

# Run the async function
asyncio.run(execute_agent())
"""

                # Run the agent code
                result = sandbox.run_code(agent_code)

                logger.info(f"E2B execution completed for run {run_id}")
                logger.info(f"Stdout: {result.logs.stdout}")

                if result.error:
                    logger.error(f"E2B execution error: {result.error}")
                    return {
                        "status": "failed",
                        "error": result.error,
                        "output": {"stdout": result.logs.stdout, "stderr": result.logs.stderr}
                    }

                # Parse result from stdout (last line should be JSON)
                try:
                    # stdout can be a list or string depending on E2B version
                    if isinstance(result.logs.stdout, list):
                        output_lines = result.logs.stdout
                    else:
                        output_lines = result.logs.stdout.strip().split('\n')

                    # Try to parse last line as JSON
                    if output_lines:
                        result_json = json.loads(output_lines[-1])
                        return result_json
                    else:
                        raise ValueError("No output lines")
                except (json.JSONDecodeError, IndexError, ValueError) as e:
                    logger.warning(f"Could not parse JSON result: {e}")
                    return {
                        "status": "completed",
                        "error": None,
                        "output": {"stdout": result.logs.stdout}
                    }

            finally:
                # Always close sandbox
                logger.info("Closing E2B sandbox...")
                sandbox.kill()

        except Exception as e:
            logger.exception(f"E2B sandbox execution failed: {e}")
            return {
                "status": "failed",
                "error": f"E2B sandbox error: {str(e)}",
                "output": None
            }

    def check_availability(self) -> Dict[str, Any]:
        """
        Check if E2B is available and properly configured.

        Returns:
            {
                "available": bool,
                "api_key_configured": bool,
                "package_installed": bool,
                "error": str | None
            }
        """
        return {
            "available": self.e2b_available,
            "api_key_configured": bool(self.e2b_api_key),
            "package_installed": self.Sandbox is not None,
            "error": None if self.e2b_available else "E2B not properly configured"
        }
