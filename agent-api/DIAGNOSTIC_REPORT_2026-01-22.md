# COMPREHENSIVE DIAGNOSTIC AUDIT REPORT
## SwissBrain Agent Execution System
**Date:** 2026-01-22 11:38 UTC

---

## SECTION 1: KUBERNETES INFRASTRUCTURE STATUS

### 1.1 Cluster & Node Status
```
All pods running successfully:
- agent-api-559bf69bdc-h9rzk      1/1 Running (68m)
- agent-worker-7fc4cd8866-7tm6v   1/1 Running (68m)
- agent-worker-7fc4cd8866-xz2wf   1/1 Running (68m)
- grafana, prometheus - Running
```
**Status:** ✅ HEALTHY

### 1.2 Worker Heartbeat & Logs
```json
{
  "worker_heartbeat": "2026-01-22T11:38:21.310276",
  "redis_connected": true
}
```

Worker logs show continuous polling:
```
HTTP Request: GET .../agent_runs?status=eq.queued... "HTTP/2 200 OK"
```
**Status:** ✅ WORKERS RUNNING AND POLLING

### 1.3 Redis Queue Statistics
```json
{
  "queue_stats": {
    "pending": 0,
    "processing": 0,
    "high_priority": 0,
    "retry": 0,
    "failed": 20
  }
}
```
**Status:** ⚠️ 20 FAILED JOBS IN QUEUE

---

## SECTION 2: FAILED JOB ANALYSIS

### 2.1 Recent Failures (from debug endpoint)
| Run ID | Error | Failed At |
|--------|-------|-----------|
| 9aff2b86... | PGRST116: Cannot coerce to single JSON (0 rows) | 09:54:34 |
| d370fac9... | PGRST116: Cannot coerce to single JSON (0 rows) | 09:50:28 |
| 468126b7... | PGRST116: Cannot coerce to single JSON (0 rows) | 09:46:31 |
| edb65f03... | Pydantic: artifacts Input should be valid list | 08:16:53 |
| 0cdb964c... | 'Sandbox' object has no attribute 'process' | Jan 21 23:06 |

### 2.2 Root Cause Identified
The PGRST116 errors were caused by `.single()` queries on tables that could return 0 rows:

**planner.py:33 (FIXED in v32-planner-fix):**
```python
# OLD (broke when user had no credit_balances record):
result = self.supabase.table("credit_balances").select(...).eq("user_id", self.user_id).single().execute()

# FIXED:
result = self.supabase.table("credit_balances").select(...).eq("user_id", self.user_id).execute()
balance = result.data[0] if result.data else {}
```

---

## SECTION 3: CRITICAL ARCHITECTURE FINDING

### 3.1 DUAL EXECUTION PATH DETECTED

The system has **TWO independent execution paths**:

#### Path A: Supabase Edge Function (Currently Used by Frontend)
```
Frontend (useAgentExecutionV2.ts:377)
    ↓
https://ghmmdochvlrnwbruyrqk.supabase.co/functions/v1/agent-execute
    ↓
Edge Function creates run with status='executing' directly
    ↓
Executes AgentPlanner + AgentSupervisor synchronously
```

#### Path B: K8s Agent API + Worker (Not Used)
```
Frontend (if configured)
    ↓
https://api.swissbrain.ai/agent/execute
    ↓
API creates run with status='queued' + pushes to Redis
    ↓
Worker polls Supabase for status='queued' runs
    ↓
Worker executes AgentPlanner + AgentSupervisor
```

### 3.2 Evidence
**Frontend hook** (`useAgentExecutionV2.ts:20-21`):
```typescript
const SUPABASE_FUNCTIONS_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co/functions/v1';
const AGENT_API_URL = import.meta.env.VITE_API_URL || 'https://api.swissbrain.ai';
```

**Task creation uses Edge Function** (`useAgentExecutionV2.ts:377-383`):
```typescript
const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/agent-execute`, {
  method: 'POST',
  // ...
});
```

**Worker polls Supabase, NOT Redis** (`main.py:168-193`):
```python
# Worker dequeues from JobQueue which now polls Supabase directly:
job = self.queue.dequeue(timeout=5)
```

### 3.3 Why Tasks Appear Stuck
1. Frontend calls Edge Function → creates run with status='executing'
2. Edge Function executes synchronously (50s timeout limit)
3. If execution times out or fails → run may stay in 'executing' state
4. K8s Worker only looks for `status='queued'` runs → never picks up edge function runs

---

## SECTION 4: REMAINING `.single()` VULNERABILITIES

**supervisor.py:422** - Will fail if user has no credit_balance record:
```python
async def _check_credits(self) -> bool:
    result = self.supabase.table("credit_balances").select("available_credits").eq("user_id", self.user_id).single().execute()
    data = result.data or {}
    return data.get("available_credits", 0) > 0
```

**supervisor.py:435** - Could fail if run was deleted:
```python
result = self.supabase.table("agent_runs").select("total_credits_used").eq("id", self.run_id).single().execute()
```

**supervisor.py:444** - Same vulnerability:
```python
result = self.supabase.table("agent_runs").select("status").eq("id", self.run_id).single().execute()
```

---

## SECTION 5: EDGE FUNCTION ANALYSIS

**agent-execute/index.ts** - Key behavior:
- Lines 129-154: Auto-creates credit_balance for new users (mitigates PGRST116)
- Lines 219-220: Has 50-second timeout on execution
- Lines 214-261: Executes planning + execution synchronously

```typescript
// Auto-create credit balance (mitigates .single() issue)
if (!balance) {
  const { data: newBalance } = await supabase
    .from('credit_balances')
    .insert({ user_id: userId, available_credits: 10000 })
    .select().single();
}
```

---

## SECTION 6: DATA FLOW SUMMARY

### Expected Flow (K8s Path - Not Currently Used):
```
1. Frontend → POST /agent/execute (K8s API)
2. API creates run (status='queued') + pushes to Redis
3. Worker dequeues from Redis
4. Worker executes planner → supervisor
5. Worker updates run status in Supabase
6. Frontend polls for status
```

### Actual Flow (Edge Function Path - Currently Used):
```
1. Frontend → POST /agent-execute (Supabase Edge Function)
2. Edge Function creates run (status='created')
3. Edge Function sets status='planning' → 'executing'
4. Edge Function executes planner → supervisor (50s timeout)
5. Edge Function updates final status
6. Frontend polls or connects SSE for updates
```

---

## SECTION 7: RECOMMENDATIONS

### High Priority Issues:
1. **Architecture Mismatch**: K8s workers are idle because frontend uses Edge Functions
2. **Edge Function Timeout**: 50s limit may be too short for complex tasks
3. **`.single()` Vulnerabilities**: supervisor.py has 3 remaining vulnerable queries
4. **Failed Jobs Accumulating**: 20 failed jobs in Redis queue need cleanup

### Potential Fixes:
1. **Route frontend to K8s API** OR **Remove K8s worker** (choose one path)
2. **Fix remaining `.single()` calls** in supervisor.py
3. **Clear failed jobs from Redis** to clean up queue
4. **Increase Edge Function timeout** or implement chunked execution

---

## SECTION 8: CURRENT SYSTEM STATE

| Component | Status | Notes |
|-----------|--------|-------|
| K8s API Pod | ✅ Running | api.swissbrain.ai healthy |
| K8s Worker Pods (2x) | ✅ Running | Polling but idle (no queued jobs) |
| Redis (Upstash) | ✅ Connected | SSL working, 20 failed jobs |
| Edge Function | ✅ Deployed | agent-execute, agent-status active |
| Frontend Hook | ✅ Working | Using Edge Function path |
| planner.py | ✅ Fixed | v32-planner-fix deployed |
| supervisor.py | ⚠️ Vulnerable | 3 `.single()` calls remain |

---

## SECTION 9: FILES ANALYZED

### Backend (agent-api)
- `app/agent/planner.py` - Plan generation (FIXED)
- `app/agent/supervisor.py` - Execution orchestrator (HAS VULNERABILITIES)
- `app/worker/main.py` - Worker entry point
- `app/worker/job_processor.py` - Job processing logic
- `app/routes/execute.py` - API execute endpoint
- `app/routes/status.py` - API status endpoint
- `app/routes/debug.py` - Debug endpoint
- `app/redis/clients.py` - Redis connection setup

### Frontend (src)
- `src/hooks/useAgentExecutionV2.ts` - Primary execution hook

### Edge Functions (supabase/functions)
- `agent-execute/index.ts` - Main execution edge function
- `agent-status/index.ts` - Status polling edge function

---

## SECTION 10: DEPLOYMENT HISTORY (Recent)

| Version | Description | Time |
|---------|-------------|------|
| v32-planner-fix | Fixed `.single()` in planner.py | ~68 min ago |
| v31-debug | Enhanced debug endpoint | Earlier |
| v30-redis-ssl | Added SSL support for Upstash | Earlier |
| v29-redis-fix | Fixed Redis client initialization | Earlier |
| v28-status-fix | Fixed phase_number column error | Earlier |

---

**END OF DIAGNOSTIC REPORT**

*Generated by Claude Code diagnostic audit*
