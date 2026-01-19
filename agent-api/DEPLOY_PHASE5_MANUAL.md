# Phase 5: Manual Deployment Steps

The Docker image has been successfully built and pushed:
- **Image**: `docker.io/axessvideo/agent-api:v12-phase5`
- **Digest**: `sha256:e19d5b68509a46e6b987a354a8be44211ee87a45b0c7152902799117005307ad`

## Step 1: Apply Database Migration

Run the Supabase migration to create the prompt management tables:

```bash
# Option 1: Using Supabase CLI
cd /Users/malena/swiss-ai-vault/agent-api
supabase db push supabase_migrations/20260115000001_prompt_management.sql

# Option 2: Via Supabase Dashboard
# 1. Go to https://app.supabase.com
# 2. Select your project
# 3. Go to SQL Editor
# 4. Copy and paste the contents of:
#    supabase_migrations/20260115000001_prompt_management.sql
# 5. Run the query
```

## Step 2: Update Kubernetes Deployments

Update both the API and worker deployments to use the new image:

```bash
# Update agent-api deployment
kubectl set image deployment/agent-api \
  agent-api=docker.io/axessvideo/agent-api:v12-phase5 \
  -n agents

# Update agent-worker deployment
kubectl set image deployment/agent-worker \
  agent-worker=docker.io/axessvideo/agent-api:v12-phase5 \
  -n agents
```

## Step 3: Wait for Rollout

Wait for the deployments to complete:

```bash
# Wait for API rollout
kubectl rollout status deployment/agent-api -n agents --timeout=5m

# Wait for worker rollout
kubectl rollout status deployment/agent-worker -n agents --timeout=5m
```

## Step 4: Verify Deployment

Check that pods are running:

```bash
# Check pod status
kubectl get pods -n agents

# Check API logs
kubectl logs -f deployment/agent-api -n agents --tail=50

# Look for these success messages:
# - "agent_api_started"
# - "redis_connected"
# - Routes registered for prompt management
```

## Step 5: Test Phase 5 Endpoints

Test the new prompt management endpoints:

```bash
# Set up port forward
kubectl port-forward -n agents deployment/agent-api 8000:8000 &

# Wait a few seconds
sleep 3

# Test 1: Health check
curl -s http://localhost:8000/health | jq

# Test 2: Check if prompt routes are registered (requires auth)
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/prompts/versions/test

# Should return 401 (auth required) - this means the route exists!

# Test 3: OpenAPI docs
curl -s http://localhost:8000/openapi.json | jq '.paths | keys' | grep prompts

# Kill port-forward
pkill -f "port-forward"
```

## Step 6: Test with Authentication

If you have an auth token:

```bash
# Set your token
export TOKEN="your-jwt-token-here"

# Create a version
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

## Step 7: Verify Database Tables

Check that the tables were created:

```sql
-- In Supabase SQL Editor or psql

-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'prompt_%';

-- Should return:
-- prompt_versions
-- prompt_templates
-- prompt_ab_tests
-- prompt_metrics

-- Check a table structure
\d prompt_versions
```

## Troubleshooting

### Issue: Migration fails

**Solution**: Check if tables already exist
```sql
DROP TABLE IF EXISTS prompt_metrics;
DROP TABLE IF EXISTS prompt_ab_tests;
DROP TABLE IF EXISTS prompt_templates;
DROP TABLE IF EXISTS prompt_versions;
```
Then re-run the migration.

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

**Check main.py**:
```bash
# Verify prompts router is registered
kubectl exec -n agents deployment/agent-api -- python -c "
from app.main import app
print('Registered routes:')
for route in app.routes:
    print(f'  {route.path}')
" | grep prompts
```

### Issue: Authentication fails (401)

**Check auth setup**:
- Verify JWT token is valid
- Check if Supabase auth is configured
- Test with service role key temporarily

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

## Success Indicators

✅ **Deployment Successful When**:
1. All pods are running (kubectl get pods -n agents)
2. Health endpoint returns healthy
3. Logs show "agent_api_started"
4. Prompt routes return 401 (not 404) without auth
5. Database tables exist in Supabase
6. API docs show prompt endpoints

## Next Steps After Deployment

1. **Create Initial Prompts**: Create versions for your agent prompts
2. **Set Up A/B Tests**: Test different prompt variations
3. **Monitor Metrics**: Track performance in production
4. **Configure Frontend**: Deploy React frontend (optional)
5. **Set Up Alerts**: Monitor for performance degradation

## Frontend Deployment (Optional)

The React frontend is ready but not deployed yet. To deploy:

```bash
# Build frontend
cd frontend
npm install
npm run build

# Option 1: Serve from FastAPI
# The dist/ folder will be served by FastAPI at root

# Option 2: Deploy to CDN
# Upload dist/ to S3, Vercel, Netlify, etc.

# Option 3: Separate domain
# Deploy to separate domain with API proxy
```

## Production URLs

Once deployed, your prompt management system will be available at:

- **API**: https://api.swissbrain.ai/api/prompts/*
- **Docs**: https://api.swissbrain.ai/docs
- **Frontend**: https://api.swissbrain.ai/ (when deployed)

## Support

If you encounter issues:
1. Check logs: `kubectl logs -f deployment/agent-api -n agents`
2. Verify secrets: `kubectl get secrets -n agents`
3. Test database: Run SQL queries in Supabase
4. Review documentation: `docs/PHASE5_PROMPT_MANAGEMENT.md`
