# Phase 5 Backend Deployment - Step-by-Step Guide

**Date**: January 15, 2026
**Image**: `docker.io/axessvideo/agent-api:v12-phase5`
**Digest**: `sha256:e19d5b68509a46e6b987a354a8be44211ee87a45b0c7152902799117005307ad`

---

## Prerequisites

✅ Docker image built and pushed (completed)
✅ Frontend built successfully (completed)
⏳ Database migration (to be applied)
⏳ Kubernetes deployment (to be applied)

---

## Step 1: Apply Database Migration

### Option A: Supabase Dashboard SQL Editor (Recommended)

1. **Go to Supabase Dashboard**
   - URL: https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Navigate to: SQL Editor (left sidebar)
   - Click "New Query"

3. **Apply Migration**
   - Open file: `supabase_migrations/20260115000001_prompt_management.sql`
   - Copy all contents
   - Paste into SQL editor
   - Click "Run" button

4. **Verify Tables Created**
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name LIKE 'prompt_%';
   ```

   **Expected Result**: 4 tables
   - `prompt_versions`
   - `prompt_templates`
   - `prompt_ab_tests`
   - `prompt_metrics`

### Option B: Supabase CLI (if project linked)

```bash
cd /Users/malena/swiss-ai-vault/agent-api
supabase db push
```

---

## Step 2: Deploy to Kubernetes

### Automated Deployment (Recommended)

Run the automated deployment script:

```bash
cd /Users/malena/swiss-ai-vault/agent-api
./deploy_phase5_backend.sh
```

The script will:
1. ✅ Confirm database migration applied
2. 🚀 Update agent-api deployment to v12-phase5
3. 🚀 Update agent-worker deployment to v12-phase5
4. ⏳ Wait for rollouts to complete
5. ✅ Verify pods are running
6. 📋 Show recent logs

### Manual Deployment (Alternative)

If you prefer manual control:

```bash
# Update agent-api deployment
kubectl set image deployment/agent-api \
  agent-api=docker.io/axessvideo/agent-api:v12-phase5 \
  -n agents

# Update agent-worker deployment
kubectl set image deployment/agent-worker \
  agent-worker=docker.io/axessvideo/agent-api:v12-phase5 \
  -n agents

# Wait for API rollout
kubectl rollout status deployment/agent-api -n agents --timeout=5m

# Wait for worker rollout
kubectl rollout status deployment/agent-worker -n agents --timeout=5m

# Check pod status
kubectl get pods -n agents

# Check logs
kubectl logs -f deployment/agent-api -n agents --tail=50
```

---

## Step 3: Verify Deployment

### 3.1 Check Pod Status

```bash
kubectl get pods -n agents
```

**Expected**: All pods should be in `Running` state

### 3.2 Check API Health

Set up port forwarding:

```bash
kubectl port-forward -n agents deployment/agent-api 8000:8000 &
sleep 3
```

Test health endpoint:

```bash
curl -s http://localhost:8000/health | jq
```

**Expected Output**:
```json
{
  "status": "healthy",
  "version": "v12-phase5"
}
```

### 3.3 Verify Phase 5 Routes Exist

Check if prompt routes are registered:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/prompts/versions/test
```

**Expected**: `401` (route exists, requires auth)
**Not 404**: If you get 404, routes aren't registered

### 3.4 Check OpenAPI Documentation

```bash
curl -s http://localhost:8000/openapi.json | jq '.paths | keys' | grep prompts
```

**Expected Output**:
```
"/api/prompts/ab-tests"
"/api/prompts/ab-tests/{test_id}"
"/api/prompts/ab-tests/{test_id}/complete"
"/api/prompts/ab-tests/{test_id}/results"
"/api/prompts/metrics/record"
"/api/prompts/metrics/{prompt_id}"
"/api/prompts/metrics/{prompt_id}/history"
"/api/prompts/metrics/top"
"/api/prompts/optimize"
"/api/prompts/optimize/{prompt_id}/analyze"
"/api/prompts/optimize/{prompt_id}/optimal"
"/api/prompts/optimize/{prompt_id}/recommendations"
"/api/prompts/templates"
"/api/prompts/templates/render"
"/api/prompts/templates/{template_id}"
"/api/prompts/versions"
"/api/prompts/versions/activate"
"/api/prompts/versions/rollback"
"/api/prompts/versions/{prompt_id}"
"/api/prompts/versions/{prompt_id}/active"
"/api/prompts/versions/{prompt_id}/{version}"
```

### 3.5 Check Logs for Success Messages

```bash
kubectl logs deployment/agent-api -n agents --tail=50 | grep -i "prompt\|route\|started"
```

**Expected Messages**:
- `agent_api_started`
- `redis_connected`
- Routes registered for prompt management

---

## Step 4: Test with Authentication (Optional)

If you have an auth token:

```bash
export TOKEN="your-jwt-token-here"

# Create a prompt version
curl -X POST http://localhost:8000/api/prompts/versions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt_id": "test-prompt",
    "content": "You are a helpful assistant",
    "system_prompt": "Be concise and clear"
  }' | jq

# List versions
curl -X GET http://localhost:8000/api/prompts/versions/test-prompt \
  -H "Authorization: Bearer $TOKEN" | jq

# Get metrics
curl -X GET "http://localhost:8000/api/prompts/metrics/test-prompt?days=30" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## Troubleshooting

### Issue: Migration fails with "relation already exists"

**Solution**: Tables already exist, skip migration or drop tables first:

```sql
DROP TABLE IF EXISTS prompt_metrics;
DROP TABLE IF EXISTS prompt_ab_tests;
DROP TABLE IF EXISTS prompt_templates;
DROP TABLE IF EXISTS prompt_versions;
```

Then re-run migration.

### Issue: Pods not starting

**Check logs**:
```bash
kubectl describe pod -n agents -l app=agent-api
kubectl logs -n agents -l app=agent-api --tail=100
```

**Common issues**:
- Import errors: Check if new dependencies are in requirements.txt
- Database connection: Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets

### Issue: Routes not found (404)

**Verify routes registered**:
```bash
kubectl exec -n agents deployment/agent-api -- python -c "
from app.main import app
print('Registered routes:')
for route in app.routes:
    print(f'  {route.path}')
" | grep prompts
```

### Issue: Authentication fails (401)

**Check**:
- JWT token is valid
- Supabase auth is configured
- Service role key is set in secrets

---

## Success Indicators

✅ **Deployment Successful When**:
1. ✅ All pods are running (`kubectl get pods -n agents`)
2. ✅ Health endpoint returns healthy
3. ✅ Logs show "agent_api_started"
4. ✅ Prompt routes return 401 (not 404) without auth
5. ✅ Database tables exist in Supabase
6. ✅ API docs show all 20+ prompt endpoints

---

## What Was Deployed

### Backend Components
- ✅ PromptVersionManager - Version lifecycle
- ✅ PromptTemplateSystem - Template management
- ✅ ABTestingFramework - A/B testing
- ✅ MetricsTracker - Performance tracking
- ✅ PromptOptimizer - Intelligent recommendations

### API Endpoints (35+)
- `/api/prompts/versions/*` - Version management
- `/api/prompts/templates/*` - Template operations
- `/api/prompts/ab-tests/*` - A/B testing
- `/api/prompts/metrics/*` - Metrics and analytics
- `/api/prompts/optimize/*` - Optimization

### Database Tables
- `prompt_versions` - Version control
- `prompt_templates` - Reusable templates
- `prompt_ab_tests` - A/B experiments
- `prompt_metrics` - Performance data

---

## Next Steps After Deployment

1. **Create Initial Prompts**: Create versions for your agent prompts
2. **Set Up A/B Tests**: Test different prompt variations
3. **Monitor Metrics**: Track performance in production
4. **Deploy Frontend**: Deploy React frontend (optional)
5. **Set Up Alerts**: Monitor for performance degradation

---

## Production URLs

Once deployed, your prompt management system will be available at:

- **API**: https://api.swissbrain.ai/api/prompts/*
- **Docs**: https://api.swissbrain.ai/docs
- **OpenAPI**: https://api.swissbrain.ai/openapi.json

---

## Support

If you encounter issues:
1. Check logs: `kubectl logs -f deployment/agent-api -n agents`
2. Verify secrets: `kubectl get secrets -n agents`
3. Test database: Run SQL queries in Supabase
4. Review documentation: `PHASE5_COMPLETE.md`

**Phase 5 Prompt Management System Ready to Deploy! 🚀**
