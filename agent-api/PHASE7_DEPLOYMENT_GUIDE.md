# Phase 7 Deployment Guide
**SwissBrain Wide Research System**

---

## 📋 Deployment Overview

Phase 7 introduces a parallel multi-agent research system that enables:
- Distributing research tasks across multiple agents (up to 20)
- Collecting and synthesizing results
- Real-time progress tracking
- Comprehensive error handling

## 🎯 Deployment Checklist

- [ ] Database migration applied
- [ ] Docker image built and pushed
- [ ] Kubernetes deployment updated
- [ ] Health checks passed
- [ ] Integration planning complete

---

## 🚀 Quick Deploy

### Option 1: Automated Script (Recommended)

```bash
cd /Users/malena/swiss-ai-vault/agent-api
./deploy_phase7_backend.sh
```

The script will:
1. Verify prerequisites
2. Guide you through database migration
3. Build and push Docker image
4. Update Kubernetes deployments
5. Verify deployment health

### Option 2: Manual Steps

Follow the sections below for manual deployment.

---

## 📊 Step 1: Database Migration

### Migration File
`supabase_migrations/20260115000002_research_jobs.sql`

### Tables Created

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `research_jobs` | Main job tracking | Status, progress, error handling |
| `research_subtasks` | Agent subtasks | Per-agent task management |
| `research_results` | Agent results | Individual findings, confidence |
| `research_synthesis` | Final output | Aggregated findings, recommendations |

### Apply Migration

**Via Supabase Dashboard (Recommended):**

1. Go to [Supabase SQL Editor](https://app.supabase.com/project/YOUR_PROJECT_ID/sql)
2. Click "New Query"
3. Copy the entire contents of `supabase_migrations/20260115000002_research_jobs.sql`
4. Paste into the SQL editor
5. Click "Run"

**Via Supabase CLI (if project linked):**

```bash
cd /Users/malena/swiss-ai-vault
supabase db push
```

### Verify Migration

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'research_%';

-- Should return:
-- research_jobs
-- research_subtasks
-- research_results
-- research_synthesis
```

---

## 🐳 Step 2: Build and Push Docker Image

### Build Image

```bash
cd /Users/malena/swiss-ai-vault/agent-api

docker build --platform linux/amd64 \
  -t docker.io/axessvideo/agent-api:v13-phase7 \
  .
```

### Push to Registry

```bash
# Login if needed
docker login

# Push image
docker push docker.io/axessvideo/agent-api:v13-phase7
```

### Verify Image

```bash
docker images | grep agent-api
# Should show v13-phase7 tag
```

---

## ☸️ Step 3: Deploy to Kubernetes

### Update API Deployment

```bash
kubectl set image deployment/agent-api \
  agent-api=docker.io/axessvideo/agent-api:v13-phase7 \
  -n agents
```

### Update Worker Deployment

```bash
kubectl set image deployment/agent-worker \
  worker=docker.io/axessvideo/agent-api:v13-phase7 \
  -n agents
```

### Wait for Rollout

```bash
# API
kubectl rollout status deployment/agent-api -n agents --timeout=120s

# Worker
kubectl rollout status deployment/agent-worker -n agents --timeout=120s
```

---

## ✅ Step 4: Verify Deployment

### Check Pod Status

```bash
# All pods
kubectl get pods -n agents

# API pods
kubectl get pods -n agents -l app=agent-api

# Worker pods
kubectl get pods -n agents -l app=agent-worker
```

Expected output:
```
NAME                           READY   STATUS    RESTARTS   AGE
agent-api-xxxxx-xxxxx         1/1     Running   0          2m
agent-worker-xxxxx-xxxxx      1/1     Running   0          2m
```

### Check Logs

```bash
# API logs
kubectl logs -f deployment/agent-api -n agents

# Worker logs
kubectl logs -f deployment/agent-worker -n agents

# Look for Phase 7 initialization
kubectl logs deployment/agent-worker -n agents | grep "research"
```

### Test Phase 7 Module

```bash
# Connect to API pod
kubectl exec -it deployment/agent-api -n agents -- python3 -c "
from app.research import WideResearchJobManager, ParallelAgentCoordinator, ResultSynthesizer
print('✓ Phase 7 modules imported successfully')

# Create test job
manager = WideResearchJobManager()
job = manager.create_job('Test Topic', num_agents=3)
print(f'✓ Created test job: {job.job_id}')
print(f'✓ Status: {job.status}')
"
```

---

## 🔧 Step 5: Integration Planning

Phase 7 is deployed but not yet integrated with the existing agent system. Next steps:

### 5.1 Connect to Agent Supervisor

Create integration in `app/agent/supervisor.py`:

```python
from app.research import WideResearchJobManager, ParallelAgentCoordinator

class AgentSupervisor:
    def __init__(self, ...):
        # ... existing init ...
        self.research_manager = WideResearchJobManager()
        self.research_coordinator = ParallelAgentCoordinator(
            self.research_manager,
            self._execute_research_subtask
        )

    async def _execute_research_subtask(self, job_id, subtask, topic):
        """Execute a research subtask using existing agent tools"""
        # Implement using existing search/browse tools
        pass
```

### 5.2 Add API Endpoints

Create `app/routes/research.py`:

```python
from fastapi import APIRouter, Depends
from app.research import WideResearchJobManager

router = APIRouter(prefix="/research", tags=["research"])

@router.post("/jobs")
async def create_research_job(topic: str, num_agents: int = 5):
    """Create a new wide research job"""
    manager = WideResearchJobManager()
    job = manager.create_job(topic, num_agents)
    return job.to_dict()

@router.get("/jobs/{job_id}")
async def get_research_job(job_id: str):
    """Get research job status"""
    manager = WideResearchJobManager()
    job = manager.get_job(job_id)
    return job.to_dict() if job else {"error": "Not found"}

@router.get("/jobs/{job_id}/results")
async def get_research_results(job_id: str):
    """Get research job results"""
    manager = WideResearchJobManager()
    job = manager.get_job(job_id)
    return {"results": job.results} if job else {"error": "Not found"}
```

### 5.3 Frontend Integration

Update `frontend/src/integrations/supabase/agent-client.ts`:

```typescript
export interface ResearchJob {
  job_id: string;
  topic: string;
  num_agents: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  results: any[];
}

export const createResearchJob = async (
  topic: string,
  numAgents: number = 5
): Promise<ResearchJob> => {
  const response = await fetch('/api/research/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, num_agents: numAgents })
  });
  return response.json();
};

export const getResearchJob = async (jobId: string): Promise<ResearchJob> => {
  const response = await fetch(`/api/research/jobs/${jobId}`);
  return response.json();
};
```

---

## 🐛 Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n agents

# Check events
kubectl get events -n agents --sort-by='.lastTimestamp'

# Check image pull
kubectl get pods -n agents -o jsonpath='{.items[*].status.containerStatuses[*].state}'
```

### Import Errors

```bash
# Verify module structure
kubectl exec -it deployment/agent-api -n agents -- ls -la app/research/

# Test imports
kubectl exec -it deployment/agent-api -n agents -- python3 -c "import app.research; print(dir(app.research))"
```

### Database Connection Issues

```bash
# Check Supabase environment variables
kubectl get secret agent-api-secrets -n agents -o json | jq -r '.data.SUPABASE_URL' | base64 -d

# Test database connection
kubectl exec -it deployment/agent-api -n agents -- python3 -c "
from app.config import get_settings
print(f'Supabase URL: {get_settings().supabase_url}')
"
```

### Migration Not Applied

```sql
-- Check if tables exist
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'research_jobs';

-- If returns 0, migration not applied
-- Re-run migration in Supabase Dashboard
```

---

## 📈 Monitoring

### Key Metrics to Watch

1. **Job Creation Rate**
   ```sql
   SELECT COUNT(*), status
   FROM research_jobs
   WHERE created_at > NOW() - INTERVAL '1 hour'
   GROUP BY status;
   ```

2. **Average Job Duration**
   ```sql
   SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds
   FROM research_jobs
   WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '1 day';
   ```

3. **Agent Success Rate**
   ```sql
   SELECT
     COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as success_rate
   FROM research_subtasks
   WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

4. **Confidence Scores**
   ```sql
   SELECT AVG(confidence) as avg_confidence
   FROM research_synthesis
   WHERE created_at > NOW() - INTERVAL '1 day';
   ```

---

## 🔄 Rollback Procedure

If issues arise, rollback to previous version:

```bash
# Get previous image
kubectl rollout history deployment/agent-api -n agents

# Rollback API
kubectl rollout undo deployment/agent-api -n agents

# Rollback worker
kubectl rollout undo deployment/agent-worker -n agents

# Verify rollback
kubectl rollout status deployment/agent-api -n agents
kubectl rollout status deployment/agent-worker -n agents
```

### Database Rollback

If needed to remove Phase 7 tables:

```sql
-- WARNING: This will delete all research data
DROP TABLE IF EXISTS research_synthesis CASCADE;
DROP TABLE IF EXISTS research_results CASCADE;
DROP TABLE IF EXISTS research_subtasks CASCADE;
DROP TABLE IF EXISTS research_jobs CASCADE;
```

---

## ✅ Deployment Success Criteria

Phase 7 deployment is successful when:

- [x] All 4 database tables exist with correct schema
- [x] Docker image built and pushed (v13-phase7)
- [x] Both API and worker deployments updated
- [x] All pods running (1/1 READY)
- [x] Phase 7 modules import successfully
- [x] Test job can be created without errors

---

## 📚 Next Steps

After successful deployment:

1. **Phase 7 Integration** (Immediate)
   - Connect coordinator to agent supervisor
   - Add API endpoints
   - Create frontend UI

2. **Phase 8: Planner Scoring** (Next Phase)
   - Plan scoring system
   - Plan repair logic
   - Abort conditions

3. **Phase 9: Confidence & Transparency** (Future)
   - Confidence scoring
   - Language hedging
   - UI transparency

4. **Phase 10: Presentation Generation** (Future)
   - Narrative construction
   - Visualization validation
   - Export functionality

---

## 📞 Support

For issues or questions:
- Check logs: `kubectl logs -f deployment/agent-api -n agents`
- Review Phase 7 documentation: `PHASE7_COMPLETE.md`
- Consult integration guide: `SWISSBRAIN_INTELLIGENCE_STACK.md`

---

**Phase 7 Wide Research System - Ready to Deploy! 🚀**
