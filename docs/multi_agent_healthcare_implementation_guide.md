# Multi-Agent Healthcare Module: Implementation Guide

**Author**: Manus AI
**Date**: January 28, 2026

## 1. Introduction

This guide provides a step-by-step walkthrough for implementing the **Multi-Agent Healthcare Coordination Module** within the `swiss-ai-vault` platform. It includes code examples, directory structure, and integration points. This guide assumes you have already reviewed the architecture, requirements, and prompt engineering documents.

## 2. Step 1: Directory Structure

First, create the following directory structure within the `agent-api/app/` directory. This isolates the new module, ensuring no interference with existing code.

```bash
agent-api/app/
└── multi_agent_healthcare/
    ├── __init__.py
    ├── main.py             # Main coordinator logic
    ├── worker_agents.py    # Implementation of specialist agents
    ├── prompts.py          # Stores system prompts
    ├── schemas.py          # Pydantic data models
    ├── tools.py            # Definitions for specialist tools
    └── router.py           # FastAPI router for this module
```

## 3. Step 2: Implement the Schemas

Populate `multi_agent_healthcare/schemas.py` with the Pydantic models defined in the technical requirements document. This ensures type safety and clear data contracts.

**File**: `agent-api/app/multi_agent_healthcare/schemas.py`
```python
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Literal

class SubTask(BaseModel):
    sub_task_id: str
    agent_role: str
    instructions: str
    status: Literal["pending", "in_progress", "completed", "failed"] = "pending"
    result: Dict[str, Any] | None = None

class MultiAgentTaskState(BaseModel):
    task_id: str
    original_prompt: str
    overall_status: Literal["planning", "executing", "synthesizing", "paused", "completed", "failed"] = "planning"
    plan: List[SubTask] = []
    synthesized_result: Dict[str, Any] | None = None
    human_feedback_request: str | None = None

# ... add other required schemas ...
```

## 4. Step 3: Implement the Coordinator Agent

The core logic for the orchestrator will reside in `main.py`. This class will manage the overall task lifecycle, from planning to synthesis.

**File**: `agent-api/app/multi_agent_healthcare/main.py`
```python
import json
from .prompts import HEALTHCARE_COORDINATOR_PROMPT
from .worker_agents import execute_worker_task
from app.llm.provider import LLMProvider # Assuming this is the path

class HealthcareCoordinatorAgent:
    def __init__(self, task_state: MultiAgentTaskState):
        self.task_state = task_state
        self.llm_provider = LLMProvider()

    async def run(self):
        if self.task_state.overall_status == "planning":
            await self._planning_phase()
        
        if self.task_state.overall_status == "executing":
            await self._execution_phase()

        if self.task_state.overall_status == "synthesizing":
            await self._synthesis_phase()

    async def _planning_phase(self):
        print(f"Task {self.task_state.task_id}: Entering planning phase.")
        # Use the LLM to create a plan based on the original prompt
        response = await self.llm_provider.create_message(
            model="anthropic/claude-3-opus-20240229", # Or your preferred Opus model
            system_prompt=HEALTHCARE_COORDINATOR_PROMPT,
            messages=[{"role": "user", "content": self.task_state.original_prompt}]
        )
        
        # Naive parsing, add robust error handling
        plan_data = json.loads(response.content[0].text)
        self.task_state.plan = [SubTask(**sub_task_data) for sub_task_data in plan_data["plan"]]
        self.task_state.overall_status = "executing"
        print(f"Task {self.task_state.task_id}: Plan created, moving to execution.")

    async def _execution_phase(self):
        print(f"Task {self.task_state.task_id}: Entering execution phase.")
        for sub_task in self.task_state.plan:
            if sub_task.status == "pending":
                sub_task.status = "in_progress"
                try:
                    sub_task.result = await execute_worker_task(sub_task)
                    sub_task.status = "completed"
                except Exception as e:
                    sub_task.status = "failed"
                    sub_task.result = {"error": str(e)}
                    # Add more robust error handling/retry logic here
        
        self.task_state.overall_status = "synthesizing"

    async def _synthesis_phase(self):
        print(f"Task {self.task_state.task_id}: Entering synthesis phase.")
        # This phase would use another LLM call to synthesize the results
        # from all sub_tasks into a final answer.
        # ... implementation for synthesis ...
        self.task_state.overall_status = "completed"
        print(f"Task {self.task_state.task_id}: Task completed.")

```

## 5. Step 4: Implement a Worker Agent

In `worker_agents.py`, you will implement the logic for the specialist agents. This example shows a simplified dispatcher function.

**File**: `agent-api/app/multi_agent_healthcare/worker_agents.py`
```python
from .schemas import SubTask
from .prompts import get_worker_prompt
from .tools import get_tools_for_role
from app.llm.provider import LLMProvider

async def execute_worker_task(sub_task: SubTask) -> dict:
    print(f"Executing sub-task {sub_task.sub_task_id} for role {sub_task.agent_role}")
    llm_provider = LLMProvider()
    system_prompt = get_worker_prompt(sub_task.agent_role)
    tools = get_tools_for_role(sub_task.agent_role)

    # This is a simplified single-turn execution.
    # A real implementation would involve a loop for multi-step tool use.
    response = await llm_provider.create_message(
        model="anthropic/claude-3-sonnet-20240229", # Or your preferred Sonnet/Haiku model
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": sub_task.instructions}],
        tools=tools
    )

    # Process tool calls and return the final result
    # ... tool execution logic ...

    final_result = {"content": response.content[0].text}
    return final_result
```

## 6. Step 5: API Endpoint and Routing

Finally, create the FastAPI router in `router.py` and include it in the main `agent-api` application.

**File**: `agent-api/app/multi_agent_healthcare/router.py`
```python
from fastapi import APIRouter, BackgroundTasks
from .schemas import TaskCreationRequest, TaskCreationResponse, MultiAgentTaskState
from .main import HealthcareCoordinatorAgent
import uuid

router = APIRouter()

# In-memory store for simplicity. Use a persistent DB (e.g., Redis, Postgres) in production.
TASKS = {}

def run_agent_task(task_id: str):
    task_state = TASKS[task_id]
    agent = HealthcareCoordinatorAgent(task_state)
    # In a real app, this would need to be async
    # asyncio.run(agent.run())
    print(f"Running task {task_id} in background")

@router.post("/tasks", response_model=TaskCreationResponse, status_code=202)
async def create_task(request: TaskCreationRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    task_state = MultiAgentTaskState(task_id=task_id, original_prompt=request.prompt)
    TASKS[task_id] = task_state
    
    background_tasks.add_task(run_agent_task, task_id)
    
    return TaskCreationResponse(task_id=task_id, status=task_state.overall_status)

# ... Add GET endpoint to check task status ...
```

Then, in your main FastAPI application file (e.g., `agent-api/app/main.py`), include this new router:

```python
# In agent-api/app/main.py
from app.multi_agent_healthcare.router import router as multi_agent_router

# ... other app setup ...

app.include_router(multi_agent_router, prefix="/api/v2/healthcare", tags=["Multi-Agent Healthcare"])
```

## 7. Configuration and Deployment

- **Environment Variables**: Ensure the `ANTHROPIC_API_KEY` is securely configured in your deployment environment where the `agent-api` service runs.
- **Dependencies**: Add any new Python libraries (e.g., for specific tools) to your `requirements.txt` or `pyproject.toml`.
- **Deployment**: Since the new module is part of the `agent-api` service, redeploying this service will make the new endpoint and functionality live. No changes to the Kubernetes manifests should be necessary beyond a standard image update.
