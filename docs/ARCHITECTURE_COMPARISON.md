# Swiss Agents vs Manus.im Architecture Comparison

## Executive Summary

This document analyzes the architectural differences between Swiss Agents (current implementation) and Manus.im (production-grade reference), identifying critical gaps and providing a roadmap for enterprise deployment.

**Critical Finding:** Swiss Agents attempts to run agent execution inside Supabase Edge Functions, which have hard timeout limits (10-60 seconds). This fundamentally conflicts with how AI agents operate (potentially minutes to hours of execution). Manus.im solves this with a proper queue-worker architecture.

---

## Architecture Overview

### Swiss Agents (Current)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT ARCHITECTURE                      │
│                                                                  │
│  Frontend ──POST──> agent-execute (Edge Function)                │
│                          │                                       │
│                          ├── Create agent_runs record            │
│                          ├── Generate plan (LLM call)            │
│                          ├── Execute supervisor loop ◄─ PROBLEM  │
│                          │      (50s timeout!)                   │
│                          └── Return response                     │
│                                                                  │
│  Frontend ──polling──> agent-status (every 2s)                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Manus.im (Production Reference)

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCTION ARCHITECTURE                      │
│                                                                  │
│  Frontend ──POST──> API Edge Function                            │
│                          │                                       │
│                          ├── Validate request                    │
│                          ├── Create task record                  │
│                          ├── Enqueue to Redis ◄─ FAST RETURN     │
│                          └── Return { task_id, status: queued }  │
│                                                                  │
│  Redis Queue ──────────> BullMQ Worker (dedicated process)       │
│                              │                                   │
│                              ├── Acquire task                    │
│                              ├── Run agent loop (unlimited time) │
│                              ├── Publish events to Redis Pub/Sub │
│                              └── Update database                 │
│                                                                  │
│  Frontend ◄──WebSocket──> Real-time Server                       │
│                              │                                   │
│                              └── Subscribe to Redis Pub/Sub      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Comparison

### 1. Task Creation & Dispatch

| Aspect | Swiss Agents | Manus.im |
|--------|-------------|----------|
| Entry Point | Edge Function (`agent-execute`) | Edge Function (thin API) |
| Response Time | 50+ seconds (blocking) | <100ms (async) |
| Task Storage | Immediate DB write | DB + Redis queue |
| Failure Mode | Timeout kills execution | Task persists, worker retries |

**Swiss Agents Current Code:**
```typescript
// supabase/functions/agent-execute/index.ts
const result = await Promise.race([
  supervisor.execute(),  // BLOCKS until done or timeout
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Execution timeout')), 50000)
  )
]);
```

**Manus.im Pattern:**
```typescript
// Edge Function - returns immediately
async function handleCreate(prompt: string, userId: string) {
  const task = await db.insert('tasks', { prompt, userId, status: 'queued' });
  await redis.xadd('tasks:queue', '*', { taskId: task.id });
  return { taskId: task.id, status: 'queued' }; // <100ms response
}
```

### 2. Execution Architecture

| Aspect | Swiss Agents | Manus.im |
|--------|-------------|----------|
| Runtime | Edge Function (Deno) | Dedicated Worker Process |
| Timeout | 50 seconds hardcoded | Unlimited (configurable) |
| Concurrency | 1 per function invocation | Worker pool (configurable) |
| Memory | Edge Function limits | Container limits (2-8GB) |
| Scaling | Serverless auto-scale | Kubernetes HPA |

**Key Problem:** Edge Functions kill all unawaited promises when the HTTP response is sent. Even with `executeInBackground()`, the promise gets terminated.

### 3. Real-time Updates

| Aspect | Swiss Agents | Manus.im |
|--------|-------------|----------|
| Mechanism | HTTP Polling (2s interval) | WebSocket + Redis Pub/Sub |
| Latency | 2000ms minimum | <50ms |
| Efficiency | High bandwidth (repeated full fetch) | Low bandwidth (delta events) |
| Scale | N requests/task/minute | 1 connection/client |

**Swiss Agents Current:**
```typescript
// useAgentExecution.ts - Polling every 2 seconds
useEffect(() => {
  const interval = setInterval(async () => {
    const status = await fetch('/agent-status', { body: { task_id } });
    setTask(status.task);
    setSteps(status.steps);
    setLogs(status.logs);
  }, 2000);
  return () => clearInterval(interval);
}, [taskId]);
```

**Manus.im Pattern:**
```typescript
// WebSocket connection with Redis Pub/Sub
const ws = new WebSocket(`wss://api.example.com/ws?task_id=${taskId}`);
ws.onmessage = (event) => {
  const { type, payload } = JSON.parse(event.data);
  switch (type) {
    case 'step_started': addStep(payload); break;
    case 'log': appendLog(payload); break;
    case 'progress': setProgress(payload); break;
    case 'completed': setStatus('completed'); break;
  }
};
```

### 4. Sandbox & Code Execution

| Aspect | Swiss Agents | Manus.im |
|--------|-------------|----------|
| Provider | Swiss K8s / Modal | E2B (primary) + Firecracker |
| Pool Management | Basic warm pool | Advanced pool with templates |
| Isolation | Container-level | microVM-level (Firecracker) |
| File System | Ephemeral | Persistent workspace |

### 5. State Management

| Aspect | Swiss Agents | Manus.im |
|--------|-------------|----------|
| State Machine | Custom implementation | Similar custom FSM |
| Locking | Fencing tokens | Redis distributed locks |
| Checkpointing | Basic (DB) | Full checkpoint with artifacts |
| Recovery | Manual retry | Automatic with backoff |

---

## Critical Gaps & Required Changes

### Gap 1: Edge Function Execution (CRITICAL)

**Problem:** Running `supervisor.execute()` inside Edge Function fails silently after response is sent.

**Solution:** Implement queue-worker separation:

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Queue-Worker Architecture                              │
│                                                                  │
│  1. Edge Function (agent-execute) - MODIFIED:                    │
│     - Validate request                                           │
│     - Create task record                                         │
│     - Call webhook/queue service                                 │
│     - Return immediately                                         │
│                                                                  │
│  2. Worker Service (NEW - runs on Railway/Fly.io/K8s):           │
│     - Poll/subscribe to task queue                               │
│     - Execute agent supervisor loop                              │
│     - No timeout constraints                                     │
│     - Horizontal scaling                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Gap 2: Real-time Updates (HIGH)

**Problem:** 2-second polling is inefficient and adds latency.

**Solution Options:**
1. **Supabase Realtime:** Subscribe to `agent_task_logs` table changes
2. **Custom WebSocket:** Deploy WebSocket server on Railway/Fly.io
3. **Server-Sent Events:** Simpler than WebSocket, works with Edge Functions

### Gap 3: Worker Infrastructure (HIGH)

**Problem:** No dedicated worker process exists.

**Solution:** Deploy worker service:

```yaml
# docker-compose.yml for worker
services:
  agent-worker:
    image: swiss-agent-worker:latest
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - REDIS_URL=${REDIS_URL}
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 2G
          cpus: '1'
```

### Gap 4: Queue System (MEDIUM)

**Problem:** No persistent queue for task dispatch.

**Solution Options:**
1. **Upstash Redis:** Serverless Redis, works well with Edge Functions
2. **Supabase Database Queue:** Use `pg_notify` for simple cases
3. **BullMQ + Redis:** Full-featured job queue

---

## Implementation Roadmap

### Phase 1: Decouple Execution (Week 1-2)

**Goal:** Move execution out of Edge Functions

```typescript
// agent-execute/index.ts - MODIFIED
async function handleCreate(...) {
  // 1. Create task record (same as now)
  const task = await createTaskRecord(supabase, userId, prompt);

  // 2. Trigger worker via webhook (instead of blocking execution)
  await fetch(WORKER_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({ task_id: task.id }),
    headers: { 'X-Worker-Secret': WORKER_SECRET }
  });

  // 3. Return immediately
  return { task_id: task.id, status: 'queued' };
}
```

**Worker Service (NEW):**
```typescript
// worker/index.ts - Runs on Railway/Fly.io
import express from 'express';

const app = express();

app.post('/execute', async (req, res) => {
  const { task_id } = req.body;
  res.json({ received: true }); // Ack immediately

  // Execute in background (no timeout!)
  executeTask(task_id).catch(console.error);
});

async function executeTask(taskId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const task = await supabase.from('agent_runs').select('*').eq('id', taskId).single();

  // Run supervisor loop (can take minutes/hours)
  const supervisor = new AgentSupervisor({
    supabase,
    runId: taskId,
    userId: task.user_id,
    plan: task.plan,
    ...
  });

  await supervisor.execute();
}

app.listen(3000);
```

### Phase 2: Add Real-time Updates (Week 2-3)

**Option A: Supabase Realtime (Easiest)**
```typescript
// Frontend - Subscribe to table changes
const channel = supabase
  .channel('task-updates')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'agent_task_logs',
    filter: `run_id=eq.${taskId}`
  }, (payload) => {
    appendLog(payload.new);
  })
  .subscribe();
```

**Option B: Custom WebSocket (More Control)**
```typescript
// Worker publishes to Redis
await redis.publish(`task:${taskId}`, JSON.stringify({
  type: 'log',
  payload: { message: 'Step completed', step_id }
}));

// WebSocket server subscribes and forwards
redis.subscribe(`task:${taskId}`, (message) => {
  ws.send(message);
});
```

### Phase 3: Production Hardening (Week 3-4)

1. **Add Redis Queue:**
   - Use Upstash Redis (serverless, integrates with Supabase)
   - Implement BullMQ for job management
   - Add retry logic with exponential backoff

2. **Deploy Worker Cluster:**
   - Railway.app or Fly.io for easy deployment
   - Kubernetes for production scale
   - Auto-scaling based on queue depth

3. **Monitoring & Observability:**
   - OpenTelemetry for distributed tracing
   - Prometheus metrics
   - Error tracking (Sentry)

---

## Quick Win: Immediate Improvement

Without major infrastructure changes, we can improve the current system:

### 1. Use Supabase Realtime Instead of Polling

```typescript
// hooks/useAgentExecution.ts - Replace polling with realtime
const useAgentExecution = (taskId: string) => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Initial load
    fetchTaskStatus(taskId).then(setTask);

    // Subscribe to changes instead of polling
    const channel = supabase
      .channel(`task-${taskId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_task_logs',
        filter: `run_id=eq.${taskId}`
      }, (payload) => {
        setLogs(prev => [...prev, payload.new]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'agent_runs',
        filter: `id=eq.${taskId}`
      }, (payload) => {
        setTask(payload.new);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [taskId]);
};
```

### 2. Use Database Trigger for Worker Dispatch

Instead of blocking in Edge Function, use a database trigger:

```sql
-- Create queue table
CREATE TABLE task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_runs(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to enqueue on task creation
CREATE OR REPLACE FUNCTION enqueue_task()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO task_queue (task_id) VALUES (NEW.id);
  -- Optionally notify via pg_notify
  PERFORM pg_notify('new_task', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_created_trigger
AFTER INSERT ON agent_runs
FOR EACH ROW EXECUTE FUNCTION enqueue_task();
```

---

## Cost-Benefit Analysis

| Approach | Implementation Effort | Improvement | Recommended |
|----------|----------------------|-------------|-------------|
| Supabase Realtime | 1 day | Eliminates polling | Yes (Quick Win) |
| Database Queue + pg_notify | 2-3 days | Basic async | Maybe |
| Worker Service (Railway) | 1 week | Full async execution | Yes (Phase 1) |
| BullMQ + Redis | 2 weeks | Enterprise queue | Yes (Phase 2) |
| Custom WebSocket | 2 weeks | Low-latency updates | Optional |

---

## Recommended Implementation Order

1. **Immediate (Day 1):** Replace polling with Supabase Realtime
2. **Week 1:** Deploy worker service on Railway/Fly.io
3. **Week 2:** Refactor agent-execute to enqueue-only
4. **Week 3:** Add Redis queue for reliability
5. **Week 4:** Production monitoring and auto-scaling

---

## Files to Modify

### Edge Function Changes
- `supabase/functions/agent-execute/index.ts` - Remove blocking execution
- `supabase/functions/agent-status/index.ts` - Keep as-is (backup for realtime)

### New Files to Create
- `worker/index.ts` - Worker service entry point
- `worker/Dockerfile` - Container definition
- `worker/supervisor-runner.ts` - Execution logic
- `infrastructure/railway.toml` - Deployment config

### Frontend Changes
- `src/hooks/useAgentExecution.ts` - Replace polling with Supabase Realtime
- `src/hooks/useAgentExecutionDev.ts` - Same changes for dev

---

## Conclusion

The fundamental issue is architectural: **Edge Functions are not designed for long-running tasks**. Manus.im correctly uses them only for quick validation and queuing, while dedicated workers handle execution.

The recommended path forward:
1. Keep Edge Functions for API (validation, queuing, status)
2. Deploy dedicated worker service for execution
3. Use Supabase Realtime or Redis Pub/Sub for updates
4. Scale workers horizontally based on demand

This approach provides:
- **Reliability:** Tasks survive function timeouts
- **Scalability:** Add workers as demand grows
- **Real-time:** Instant updates via subscriptions
- **Enterprise-ready:** Production-proven pattern
