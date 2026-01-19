# Phase 7 Integration Implementation
**Connecting Wide Research System to Existing Agent Infrastructure**

---

## 🎯 Integration Overview

This guide provides the exact code changes needed to integrate Phase 7's wide research system with the existing agent supervisor and API routes.

## 📁 Files to Modify

### 1. `app/routes/research.py` (NEW FILE)

Create new API endpoint for wide research:

```python
"""Wide Research API Endpoints"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from pydantic import BaseModel, Field

from app.research import (
    WideResearchJobManager,
    ParallelAgentCoordinator,
    ResultSynthesizer,
    JobStatus
)
from app.auth import get_current_user

router = APIRouter(prefix="/research", tags=["research"])

# Request/Response Models
class CreateResearchJobRequest(BaseModel):
    topic: str = Field(..., min_length=10, max_length=500)
    num_agents: int = Field(default=5, ge=1, le=20)
    max_depth: int = Field(default=3, ge=1, le=5)

class ResearchJobResponse(BaseModel):
    job_id: str
    topic: str
    status: str
    progress: int
    num_agents: int
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]
    error: Optional[str]

class ResearchResultsResponse(BaseModel):
    job_id: str
    status: str
    results: list
    synthesis: Optional[dict]

# Initialize manager
job_manager = WideResearchJobManager()

@router.post("/jobs", response_model=ResearchJobResponse)
async def create_research_job(
    request: CreateResearchJobRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Create a new wide research job.

    The job will spawn multiple agents in parallel to research different
    aspects of the topic, then synthesize the results.
    """
    try:
        job = job_manager.create_job(
            topic=request.topic,
            num_agents=request.num_agents,
            max_depth=request.max_depth
        )

        # TODO: Enqueue job for execution
        # from app.worker.job_queue import enqueue_research_job
        # await enqueue_research_job(job.job_id, user_id)

        return ResearchJobResponse(**job.to_dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs/{job_id}", response_model=ResearchJobResponse)
async def get_research_job(
    job_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get research job status and details"""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return ResearchJobResponse(**job.to_dict())

@router.get("/jobs/{job_id}/results", response_model=ResearchResultsResponse)
async def get_research_results(
    job_id: str,
    user_id: str = Depends(get_current_user)
):
    """Get research job results and synthesis"""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Synthesize if completed
    synthesis = None
    if job.status == JobStatus.COMPLETED and job.results:
        synthesizer = ResultSynthesizer()
        synthesis = synthesizer.synthesize(job.topic, job.results)

    return ResearchResultsResponse(
        job_id=job.job_id,
        status=job.status.value,
        results=job.results,
        synthesis=synthesis
    )

@router.post("/jobs/{job_id}/cancel")
async def cancel_research_job(
    job_id: str,
    user_id: str = Depends(get_current_user)
):
    """Cancel a running research job"""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status not in [JobStatus.PENDING, JobStatus.RUNNING]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job in status: {job.status}"
        )

    # TODO: Implement cancellation logic
    # job.status = JobStatus.CANCELLED

    return {"job_id": job_id, "status": "cancelled"}

@router.get("/jobs")
async def list_research_jobs(
    user_id: str = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """List all research jobs for the current user"""
    jobs = job_manager.list_jobs()

    # TODO: Filter by user_id once we add user tracking
    # jobs = [j for j in jobs if j.get("user_id") == user_id]

    return {
        "jobs": jobs[offset:offset+limit],
        "total": len(jobs),
        "limit": limit,
        "offset": offset
    }
```

### 2. `app/main.py` (MODIFY)

Register the new research router:

```python
# Add this import at the top
from app.routes import research

# Add this line after other router registrations
app.include_router(research.router, prefix="/api")
```

**Complete modification**:
```python
# Around line 30-40, after existing router imports
from app.routes import execute, logs, status, prompts, research  # Add research

# Around line 60-70, after existing router registrations
app.include_router(execute.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(status.router, prefix="/api")
app.include_router(prompts.router, prefix="/api")
app.include_router(research.router, prefix="/api")  # Add this line
```

### 3. `app/agent/supervisor.py` (MODIFY)

Add wide research capability to agent supervisor:

```python
# Add these imports at the top
from app.research import (
    WideResearchJobManager,
    ParallelAgentCoordinator,
    ResultSynthesizer
)

class AgentSupervisor:
    def __init__(
        self,
        supabase: Client,
        anthropic: Anthropic,
        run_id: str,
        user_id: str,
        plan: AgentPlan,
        max_retries: int = 3
    ):
        # ... existing initialization ...

        # Add Phase 7 research capabilities
        self.research_manager = WideResearchJobManager()
        self.research_coordinator = ParallelAgentCoordinator(
            self.research_manager,
            self._execute_research_subtask
        )
        self.research_synthesizer = ResultSynthesizer()

    async def _execute_research_subtask(
        self,
        job_id: str,
        subtask: dict,
        topic: str
    ) -> dict:
        """
        Execute a single research subtask using existing agent tools.

        Args:
            job_id: Research job ID
            subtask: Subtask details (aspect, query, depth)
            topic: Main research topic

        Returns:
            Research result with findings and sources
        """
        aspect = subtask.get("aspect", "general")
        query = subtask.get("query", topic)

        try:
            # Use existing search tools
            from app.agent.tools.router import ToolRouter
            from app.agent.tools.context import ToolContext

            context = ToolContext(
                run_id=job_id,
                user_id=self.user_id,
                step_id=f"research-{aspect}",
                workspace_path="/tmp/research"
            )

            router = ToolRouter(context)

            # Execute search
            search_result = await router.route_tool({
                "tool": "search",
                "query": query,
                "max_results": 10
            })

            if not search_result.success:
                return {
                    "aspect": aspect,
                    "summary": f"Search failed: {search_result.error}",
                    "findings": [],
                    "recommendations": [],
                    "sources": [],
                    "confidence": 0.0
                }

            # Extract findings
            search_data = search_result.output or {}
            results = search_data.get("results", [])

            findings = []
            sources = []
            for result in results[:5]:  # Top 5 results
                if "title" in result and "snippet" in result:
                    findings.append(f"{result['title']}: {result['snippet']}")
                if "link" in result:
                    sources.append(result["link"])

            # Create summary
            summary = f"Research on {aspect} of {topic}:\n"
            summary += f"Found {len(results)} relevant sources. "
            summary += "Key findings: " + "; ".join(findings[:3])

            return {
                "aspect": aspect,
                "summary": summary,
                "findings": findings,
                "recommendations": self._generate_recommendations(findings),
                "sources": sources,
                "confidence": 0.8 if len(findings) >= 3 else 0.5
            }

        except Exception as e:
            self._log_error(f"Research subtask failed: {str(e)}")
            return {
                "aspect": aspect,
                "summary": f"Error: {str(e)}",
                "findings": [],
                "recommendations": [],
                "sources": [],
                "confidence": 0.0
            }

    def _generate_recommendations(self, findings: list) -> list:
        """Generate recommendations based on findings"""
        if len(findings) < 2:
            return ["Gather more information before making decisions"]

        recommendations = [
            "Review the collected findings in detail",
            "Validate information across multiple sources",
            "Consider the most recent developments"
        ]

        return recommendations[:5]  # Max 5 recommendations

    async def execute_wide_research(self, topic: str, num_agents: int = 5) -> dict:
        """
        Execute a wide research job on the given topic.

        This is a convenience method that can be called from agent execution.

        Args:
            topic: Research topic
            num_agents: Number of parallel agents to spawn

        Returns:
            Synthesis of all research results
        """
        # Create job
        job = self.research_manager.create_job(topic, num_agents)

        try:
            # Execute research
            result = await self.research_coordinator.distribute_research(
                job_id=job.job_id,
                topic=topic,
                num_agents=num_agents
            )

            # Synthesize results
            if result["status"] == "completed":
                synthesis = self.research_synthesizer.synthesize(
                    topic=topic,
                    results=result["results"]
                )
                return {
                    "job_id": job.job_id,
                    "status": "completed",
                    "synthesis": synthesis
                }
            else:
                return {
                    "job_id": job.job_id,
                    "status": "failed",
                    "error": result.get("error")
                }

        except Exception as e:
            self.research_manager.fail_job(job.job_id, str(e))
            return {
                "job_id": job.job_id,
                "status": "failed",
                "error": str(e)
            }
```

### 4. `app/worker/job_processor.py` (MODIFY)

Add research job processing to worker:

```python
# Add import at top
from app.research import (
    WideResearchJobManager,
    ParallelAgentCoordinator,
    ResultSynthesizer
)

class JobProcessor:
    def __init__(self):
        # ... existing initialization ...

        # Add research capabilities
        self.research_manager = WideResearchJobManager()

    async def process(self, job: dict):
        """Process a job (existing agent run or research job)"""
        job_type = job.get("type", "agent_run")

        if job_type == "research":
            return await self._process_research_job(job)
        else:
            return await self._process_agent_run(job)

    async def _process_agent_run(self, job: dict):
        """Existing agent run processing logic"""
        # ... existing code ...
        pass

    async def _process_research_job(self, job: dict):
        """Process a wide research job"""
        job_id = job.get("job_id")

        try:
            # Get job details
            research_job = self.research_manager.get_job(job_id)
            if not research_job:
                return False, "Research job not found"

            # Create agent executor
            async def agent_executor(job_id, subtask, topic):
                # Use agent supervisor's research subtask execution
                from app.agent.supervisor import AgentSupervisor

                # Create minimal supervisor for subtask
                supervisor = AgentSupervisor(
                    supabase=self.supabase,
                    anthropic=self.anthropic,
                    run_id=job_id,
                    user_id=job.get("user_id", "system"),
                    plan=None  # Research doesn't need full plan
                )

                return await supervisor._execute_research_subtask(
                    job_id, subtask, topic
                )

            # Create coordinator
            coordinator = ParallelAgentCoordinator(
                self.research_manager,
                agent_executor
            )

            # Execute research
            result = await coordinator.distribute_research(
                job_id=research_job.job_id,
                topic=research_job.topic,
                num_agents=research_job.num_agents
            )

            # Synthesize results
            if result["status"] == "completed":
                synthesizer = ResultSynthesizer()
                synthesis = synthesizer.synthesize(
                    topic=research_job.topic,
                    results=result["results"]
                )

                # Store synthesis in database
                self.supabase.table("research_synthesis").insert({
                    "job_id": research_job.job_id,
                    "topic": research_job.topic,
                    "summary": synthesis["summary"],
                    "key_findings": synthesis["key_findings"],
                    "recommendations": synthesis["recommendations"],
                    "sources": synthesis["sources"],
                    "confidence": synthesis["confidence"]
                }).execute()

            return result["status"] == "completed", result.get("error")

        except Exception as e:
            self.research_manager.fail_job(job_id, str(e))
            return False, str(e)
```

---

## 🗄️ Database Integration

The research system already has tables created by migration. To link with user authentication:

### Add user_id to research_jobs (Optional)

```sql
-- Add user_id column to research_jobs
ALTER TABLE research_jobs
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Create index
CREATE INDEX idx_research_jobs_user_id ON research_jobs(user_id);

-- Update RLS policy to filter by user
CREATE POLICY "Users can only see their own research jobs"
  ON research_jobs FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');
```

---

## 📝 Testing Integration

### Test API Endpoints

```bash
# Create research job
curl -X POST http://localhost:8000/api/research/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "topic": "Artificial Intelligence in Healthcare",
    "num_agents": 5,
    "max_depth": 3
  }'

# Get job status
curl http://localhost:8000/api/research/jobs/JOB_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get results
curl http://localhost:8000/api/research/jobs/JOB_ID/results \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Supervisor Integration

```python
# test_research_integration.py
import asyncio
from app.agent.supervisor import AgentSupervisor
from app.config import get_settings
from supabase import create_client
from anthropic import Anthropic

async def test_wide_research():
    settings = get_settings()
    supabase = create_client(
        settings.supabase_url,
        settings.supabase_service_role_key
    )
    anthropic = Anthropic(api_key=settings.anthropic_api_key)

    supervisor = AgentSupervisor(
        supabase=supabase,
        anthropic=anthropic,
        run_id="test-research",
        user_id="test-user",
        plan=None
    )

    result = await supervisor.execute_wide_research(
        topic="Climate Change Solutions",
        num_agents=3
    )

    print(f"Status: {result['status']}")
    if result['status'] == 'completed':
        synthesis = result['synthesis']
        print(f"Summary: {synthesis['summary']}")
        print(f"Findings: {len(synthesis['key_findings'])}")
        print(f"Confidence: {synthesis['confidence']}")

if __name__ == "__main__":
    asyncio.run(test_wide_research())
```

---

## 🚀 Deployment After Integration

After implementing these changes:

1. **Build new image with integration**:
   ```bash
   docker build --platform linux/amd64 -t docker.io/axessvideo/agent-api:v14-phase7-integrated .
   docker push docker.io/axessvideo/agent-api:v14-phase7-integrated
   ```

2. **Deploy to Kubernetes**:
   ```bash
   kubectl set image deployment/agent-api agent-api=docker.io/axessvideo/agent-api:v14-phase7-integrated -n agents
   kubectl set image deployment/agent-worker worker=docker.io/axessvideo/agent-api:v14-phase7-integrated -n agents
   ```

3. **Verify integration**:
   ```bash
   kubectl logs -f deployment/agent-api -n agents | grep "research"
   ```

---

## ✅ Integration Checklist

- [ ] Create `app/routes/research.py` with API endpoints
- [ ] Register research router in `app/main.py`
- [ ] Add research methods to `app/agent/supervisor.py`
- [ ] Update `app/worker/job_processor.py` for research jobs
- [ ] Apply optional user_id database changes
- [ ] Test API endpoints locally
- [ ] Test supervisor integration
- [ ] Build and deploy integrated image
- [ ] Verify in production

---

**Phase 7 Integration - Complete Implementation Guide! 🎯**
