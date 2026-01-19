"""Agent Planner - Generates execution plans from user prompts using LLM"""
import json
import logging
from typing import List, Optional, Tuple
from supabase import Client
from anthropic import Anthropic

from app.agent.models.types import (
    ExecutionPlan,
    PlanPhase,
    PlanningConstraints,
)

logger = logging.getLogger(__name__)


class AgentPlanner:
    """Generates structured execution plans for agent tasks"""

    def __init__(self, supabase: Client, user_id: str, anthropic_client: Anthropic):
        self.supabase = supabase
        self.user_id = user_id
        self.anthropic = anthropic_client

    async def create_plan(
        self,
        prompt: str,
        constraints: Optional[PlanningConstraints] = None,
    ) -> Tuple[Optional[ExecutionPlan], Optional[str]]:
        """Create execution plan from prompt"""
        try:
            # Get user's available credits
            result = self.supabase.table("credit_balances").select("available_credits").eq("user_id", self.user_id).single().execute()
            balance = result.data if result.data else {}

            max_credits = constraints.max_credits if constraints else balance.get("available_credits", 100)

            # Get available capabilities from connectors (if table exists)
            try:
                result = self.supabase.table("connector_credentials").select("connector_type, status").eq("user_id", self.user_id).eq("status", "active").execute()
                connectors = result.data or []
            except Exception:
                # Table may not exist yet - use default capabilities only
                connectors = []

            available_capabilities = (
                constraints.available_capabilities
                if constraints and constraints.available_capabilities
                else [c.get("connector_type") for c in connectors if c.get("connector_type")]
                + ["shell", "code", "browser", "search", "message"]
            )

            # Build prompts
            system_prompt = self._build_planning_system_prompt(max_credits, available_capabilities)
            user_prompt = self._build_planning_user_prompt(prompt, constraints)

            # Call Anthropic API
            response = self.anthropic.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                temperature=0.7,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )

            # Extract plan from response
            content = response.content[0].text if response.content else None
            if not content:
                return None, "No response from LLM"

            # Parse JSON from content
            plan_data = self._extract_json(content)
            if not plan_data:
                return None, "Failed to parse plan JSON"

            # Convert to ExecutionPlan model
            plan = ExecutionPlan(**plan_data)

            # Validate plan
            valid, error = await self._validate_plan(plan, constraints)
            if not valid:
                return None, error

            return plan, None

        except Exception as e:
            logger.error(f"Planning error: {e}")
            return None, str(e)

    async def replan(
        self,
        original_plan: ExecutionPlan,
        failed_phase_number: int,
        error_message: str,
        constraints: Optional[PlanningConstraints] = None,
    ) -> Tuple[Optional[ExecutionPlan], Optional[str]]:
        """Re-plan after failure"""
        try:
            failed_phase = next(
                (p for p in original_plan.phases if p.phase_number == failed_phase_number),
                None,
            )

            system_prompt = f"""You are an AI task planner. A previous execution plan has failed and needs to be revised.

ORIGINAL PLAN:
{json.dumps(original_plan.dict(), indent=2)}

FAILURE DETAILS:
- Failed at phase {failed_phase_number}: {failed_phase.name if failed_phase else 'Unknown'}
- Error: {error_message}

Your task is to create a REVISED execution plan that:
1. Addresses the failure by modifying the failed phase or adding recovery steps
2. Keeps successful phases unchanged if possible
3. May add new phases before/after the failed phase
4. Adjusts credit estimates based on what was already consumed
5. Learns from the failure to prevent similar issues

Return a complete revised execution plan in JSON format with this structure:
{{
  "goal": "string",
  "phases": [...],
  "total_estimated_credits": number,
  "total_estimated_duration_minutes": number,
  "required_capabilities": [...],
  "risks": [...]
}}"""

            user_prompt = f"Revise the plan to fix the failure. Original goal: {original_plan.goal}"

            response = self.anthropic.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                temperature=0.7,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )

            content = response.content[0].text if response.content else None
            if not content:
                return None, "No response from LLM for replan"

            plan_data = self._extract_json(content)
            if not plan_data:
                return None, "Failed to parse revised plan JSON"

            revised_plan = ExecutionPlan(**plan_data)

            valid, error = await self._validate_plan(revised_plan, constraints)
            if not valid:
                return None, error

            return revised_plan, None

        except Exception as e:
            logger.error(f"Replanning error: {e}")
            return None, str(e)

    async def _validate_plan(
        self,
        plan: ExecutionPlan,
        constraints: Optional[PlanningConstraints],
    ) -> Tuple[bool, Optional[str]]:
        """Validate plan against constraints"""
        # Check credit constraint
        if constraints and constraints.max_credits:
            if plan.total_estimated_credits > constraints.max_credits:
                return False, f"Plan requires {plan.total_estimated_credits} credits but only {constraints.max_credits} available"

        # Check phase count constraint
        if constraints and constraints.max_phases:
            if len(plan.phases) > constraints.max_phases:
                return False, f"Plan has {len(plan.phases)} phases but maximum is {constraints.max_phases}"

        # Check capabilities constraint
        if constraints and constraints.available_capabilities:
            unavailable = set(plan.required_capabilities) - set(constraints.available_capabilities)
            if unavailable:
                return False, f"Plan requires unavailable capabilities: {', '.join(unavailable)}"

        # Validate phase structure
        for phase in plan.phases:
            # Check dependencies exist
            for dep in phase.dependencies:
                if not any(p.phase_number == dep for p in plan.phases):
                    return False, f"Phase {phase.phase_number} depends on non-existent phase {dep}"
                # Check dependency is before this phase
                if dep >= phase.phase_number:
                    return False, f"Phase {phase.phase_number} has invalid dependency on phase {dep} (must be earlier)"

            # Check phase has non-negative credits (0 is OK for message-only phases)
            if phase.estimated_credits < 0:
                return False, f"Phase {phase.phase_number} has invalid credit estimate: {phase.estimated_credits}"

        # Check total credits matches sum of phases
        phase_credits_sum = sum(p.estimated_credits for p in plan.phases)
        if abs(phase_credits_sum - plan.total_estimated_credits) > 0.01:
            return False, f"Total credits ({plan.total_estimated_credits}) doesn't match sum of phase credits ({phase_credits_sum})"

        return True, None

    def _build_planning_system_prompt(self, max_credits: float, available_capabilities: List[str]) -> str:
        """Build system prompt for planning"""
        capabilities_list = "\n".join(f"- {cap}" for cap in available_capabilities)

        return f"""You are an expert AI task planner. Your job is to break down complex user requests into structured execution plans.

AVAILABLE CAPABILITIES:
{capabilities_list}

CREDIT BUDGET: {max_credits} credits

CREDIT COSTS (approximate):
- shell command: 1 credit
- code execution: 2 credits
- browser interaction: 3 credits
- web search: 1 credit
- file operation: 1 credit
- LLM call: 5 credits
- message to user: 0 credits

PLANNING RULES:
1. Break the task into logical phases (typically 3-7 phases)
2. Each phase should have a clear goal and measurable outputs
3. Phases should build on each other (use dependencies)
4. Estimate credits conservatively (add 20% buffer)
5. Identify required capabilities for each phase
6. Flag potential risks (missing data, complex operations, etc.)
7. Stay within the credit budget
8. Phases should be atomic - completable in one execution cycle

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{{
  "goal": "Clear statement of what we're trying to accomplish",
  "phases": [
    {{
      "phase_number": 1,
      "name": "Phase name",
      "description": "Detailed description of what this phase does",
      "required_capabilities": ["shell", "code"],
      "estimated_credits": 10,
      "dependencies": [],
      "expected_outputs": ["List of concrete outputs this phase produces"]
    }}
  ],
  "total_estimated_credits": 50,
  "total_estimated_duration_minutes": 15,
  "required_capabilities": ["shell", "code", "browser"],
  "risks": ["Potential issues or challenges"]
}}"""

    def _build_planning_user_prompt(self, prompt: str, constraints: Optional[PlanningConstraints]) -> str:
        """Build user prompt for planning"""
        user_prompt = f"Create an execution plan for this request:\n\n{prompt}"

        if constraints and constraints.context:
            if previous_runs := constraints.context.get("previous_runs"):
                user_prompt += "\n\nPREVIOUS ATTEMPTS:\n"
                for run in previous_runs:
                    user_prompt += f"- Prompt: \"{run.get('prompt')}\" → {run.get('outcome')}"
                    if lessons := run.get("lessons"):
                        user_prompt += f" (Lesson: {lessons})"
                    user_prompt += "\n"

            if user_prefs := constraints.context.get("user_preferences"):
                user_prompt += "\n\nUSER PREFERENCES:\n"
                user_prompt += json.dumps(user_prefs, indent=2)

        return user_prompt

    def _extract_json(self, content: str) -> Optional[dict]:
        """Extract JSON from LLM response"""
        try:
            # Try parsing directly
            return json.loads(content)
        except json.JSONDecodeError:
            # Try extracting from markdown code block
            import re
            match = re.search(r"```json\n([\s\S]*?)\n```", content)
            if match:
                try:
                    return json.loads(match.group(1))
                except json.JSONDecodeError:
                    pass

            # Try extracting from code block without language
            match = re.search(r"```\n([\s\S]*?)\n```", content)
            if match:
                try:
                    return json.loads(match.group(1))
                except json.JSONDecodeError:
                    pass

        return None

    async def save_plan(self, run_id: str, plan: ExecutionPlan) -> bool:
        """Save plan to database"""
        try:
            self.supabase.table("agent_runs").update({"plan": plan.dict()}).eq("id", run_id).execute()
            return True
        except Exception as e:
            logger.error(f"Failed to save plan: {e}")
            return False
