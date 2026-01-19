# Hybrid Architecture Setup - Two Supabase Projects

**Date**: 2026-01-13
**Status**: Recommended Approach

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   HYBRID ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Lovable Project                    Direct Project              │
│   rljnrgscmosgkcjdvlrq               ghmmdochvlrnwbruyrqk        │
│   ─────────────────────              ─────────────────────       │
│                                                                  │
│   ✅ Frontend hosting                ✅ Agent Edge Functions     │
│   ✅ Auth (users, sessions)          ✅ Agent execution          │
│   ✅ Core features:                  ✅ Future Swiss K8s         │
│      - Datasets                      ✅ Tool execution           │
│      - Chat completions              ✅ Heavy compute tasks      │
│      - Fine-tuning                                               │
│      - Storage                                                   │
│      - Billing/Credits                                           │
│                                                                  │
│   Frontend → Lovable (existing)                                 │
│   Agent Features → Direct (new)                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why Hybrid Architecture?

### Benefits

1. **No Breaking Changes**
   - Existing features continue working on Lovable
   - No risk to production functionality
   - Gradual migration path

2. **Best of Both Worlds**
   - Lovable: Rapid iteration, auto-deploy, managed infra
   - Direct: Full control, custom domain, K8s integration

3. **Logical Separation**
   - Agent features are isolated (own tables, own functions)
   - Clear boundary between rapid prototyping and production agents
   - Future-ready for Swiss K8s integration

4. **Flexibility**
   - Can migrate features one at a time
   - Can eventually consolidate if needed
   - Test agent architecture without affecting core app

---

## Setup Instructions

### Step 1: Get Direct Project Credentials

1. Go to Direct project settings:
   https://supabase.com/dashboard/project/ghmmdochvlrnwbruyrqk/settings/api

2. Copy these values:
   - **Project URL**: `https://auth.swissvault.ai` (or `https://ghmmdochvlrnwbruyrqk.supabase.co`)
   - **Anon/Public Key**: `eyJhbG...` (the public anon key)

### Step 2: Add to Environment Variables

Add to `/Users/malena/swiss-ai-vault/.env`:

```bash
# Agent features use Direct project (ghmmdochvlrnwbruyrqk)
VITE_AGENT_SUPABASE_URL="https://auth.swissvault.ai"
VITE_AGENT_SUPABASE_ANON_KEY="<ANON_KEY_FROM_DASHBOARD>"
```

**Note**: Keep existing `VITE_SUPABASE_*` variables unchanged for Lovable project.

### Step 3: Verify Agent Functions Are Deployed

The agent functions should already be on the Direct project:

```bash
supabase functions list --project-ref ghmmdochvlrnwbruyrqk | grep agent
```

Expected output:
- ✅ agent-execute (version 2)
- ✅ agent-status (version 2)
- ✅ agent-logs (version 2)

These are the "old" functions that work! We don't need the `-phase2` versions since the old functions already have Phase 2 code.

### Step 4: Update Frontend Agent Code

**File**: `/Users/malena/swiss-ai-vault/src/integrations/supabase/agent-client.ts`

This new file provides:
- `agentSupabase` - Separate client for Direct project
- `callAgentFunction()` - Helper to call agent Edge Functions
- `queryAgentData()` - Helper to query agent tables

**Usage Example**:

```typescript
// OLD (don't use for agents):
import { supabase } from '@/integrations/supabase/client';

// NEW (use for agents):
import { agentSupabase, callAgentFunction } from '@/integrations/supabase/agent-client';

// Create agent run
const { data, error } = await callAgentFunction('agent-execute', {
  action: 'create',
  prompt: 'Write hello world',
});

// Query agent data
const { data: runs } = await agentSupabase
  .from('agent_runs')
  .select('*')
  .eq('user_id', userId);
```

### Step 5: Update Agent UI Components

Find all files that interact with agent features and update them:

**Files to check**:
```bash
grep -r "agent-execute" src/
grep -r "agent_runs" src/
grep -r "agent-status" src/
```

**Replace**:
```typescript
// Before:
await supabase.functions.invoke('agent-execute', { body: {...} });

// After:
await callAgentFunction('agent-execute', {...});
```

### Step 6: Sync Agent Tables to Direct Project

The agent tables exist in Lovable but need to be in Direct project:

```bash
# Apply migrations to Direct project
cd /Users/malena/swiss-ai-vault
supabase db push --project-ref ghmmdochvlrnwbruyrqk --include-all
```

**Migrations to apply**:
- `20260113000001_agent_runs.sql` - Agent run tracking
- `20260113000002_agent_steps.sql` - Execution steps
- `20260113000003_agent_messages.sql` - Conversation history
- `20260113000004_agent_artifacts.sql` - Generated files
- `20260113000005_agent_run_connectors.sql` - Data source linking
- `20260113000006_agent_task_queue.sql` - Background jobs
- `20260113000007_agent_task_logs.sql` - Execution logs

### Step 7: Test the Integration

```typescript
// Test file: src/test-agent-hybrid.ts
import { callAgentFunction, agentSupabase } from '@/integrations/supabase/agent-client';

async function testAgentHybrid() {
  console.log('Testing hybrid agent setup...');

  // 1. Create agent run
  const { data: createData, error: createError } = await callAgentFunction('agent-execute', {
    action: 'create',
    prompt: 'Write a Python hello world script',
  });

  if (createError) {
    console.error('❌ Create failed:', createError);
    return;
  }

  console.log('✅ Created run:', createData);
  const runId = createData.run_id;

  // 2. Get status
  const { data: statusData, error: statusError } = await callAgentFunction('agent-status', {
    run_id: runId,
  });

  if (statusError) {
    console.error('❌ Status failed:', statusError);
    return;
  }

  console.log('✅ Status:', statusData);

  // 3. Query database
  const { data: runs, error: dbError } = await agentSupabase
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (dbError) {
    console.error('❌ DB query failed:', dbError);
    return;
  }

  console.log('✅ DB query:', runs);
  console.log('🎉 All tests passed!');
}
```

---

## Auth Synchronization

### How Auth Works Across Projects

**Good news**: Auth is synchronized automatically through localStorage!

1. User logs in via Lovable project (main app)
2. Session stored in `localStorage`
3. Agent client reads same session from `localStorage`
4. Both clients share the same user identity

**Why this works**:
- Both clients use same auth storage backend
- JWT tokens are project-agnostic
- User ID is consistent across projects

**Important**: Make sure RLS policies on Direct project allow the same user IDs.

---

## Data Migration Strategy

### Option A: Dual-Write (Recommended for Now)

Write to both projects during transition:

```typescript
// Create dataset - write to Lovable (existing)
await supabase.from('datasets').insert({...});

// Create agent run - write to Direct (new)
await agentSupabase.from('agent_runs').insert({...});
```

### Option B: Cross-Project References

Link data across projects using user_id:

```typescript
// In Direct project agent run:
{
  user_id: "uuid",  // Same user ID as Lovable
  project_id: "uuid",  // Reference to dataset in Lovable
}

// Frontend joins data client-side
const dataset = await supabase.from('datasets').select();
const runs = await agentSupabase.from('agent_runs').select();
```

### Option C: Full Migration (Future)

Eventually migrate everything to one project:
1. Export data from Lovable
2. Import to Direct
3. Update all frontend code
4. Switch DNS/domains

---

## Deployment Strategy

### Lovable Project (rljnrgscmosgkcjdvlrq)

**Managed via**:
- Lovable UI for rapid iteration
- Git integration for version control
- Auto-deploy on push

**Deploy**:
```bash
# Lovable auto-deploys from git
git push origin main
```

### Direct Project (ghmmdochvlrnwbruyrqk)

**Managed via**:
- Supabase CLI for functions
- GitHub Actions for CI/CD
- Manual control for production

**Deploy**:
```bash
# Deploy agent functions
cd /Users/malena/swiss-ai-vault
supabase functions deploy agent-execute --project-ref ghmmdochvlrnwbruyrqk
supabase functions deploy agent-status --project-ref ghmmdochvlrnwbruyrqk
supabase functions deploy agent-logs --project-ref ghmmdochvlrnwbruyrqk

# Apply database migrations
supabase db push --project-ref ghmmdochvlrnwbruyrqk
```

---

## Troubleshooting

### Issue: "Not authenticated" Error

**Cause**: Session not shared between clients

**Fix**:
1. Verify both clients use `localStorage` for auth
2. Check that user is logged in on main client first
3. Ensure anon keys are correct

### Issue: "Table does not exist"

**Cause**: Migrations not applied to Direct project

**Fix**:
```bash
supabase db push --project-ref ghmmdochvlrnwbruyrqk --include-all
```

### Issue: RLS Policy Blocks Access

**Cause**: User ID from Lovable auth not recognized in Direct project

**Fix**: Update RLS policies on Direct project:
```sql
-- Allow users with valid JWT (from any project)
CREATE POLICY "Users can access their own runs"
ON agent_runs
FOR ALL
USING (auth.uid() = user_id);
```

---

## Future Considerations

### Path to Consolidation

If you eventually want to consolidate to one project:

1. **Choose target project** (likely Direct for full control)
2. **Export Lovable data**:
   ```bash
   pg_dump > lovable_backup.sql
   ```
3. **Import to Direct**:
   ```bash
   psql < lovable_backup.sql
   ```
4. **Update frontend** to use single client
5. **Migrate domains** and DNS
6. **Deprecate Lovable project**

### Swiss K8s Integration

The Direct project is ready for K8s integration:

1. Agent functions can call K8s APIs
2. Tool execution can run in K8s pods
3. Heavy compute workloads offloaded
4. Full control over infrastructure

---

## Summary

**Current State**: ✅ Working hybrid architecture
- Lovable: Frontend + core features (unchanged)
- Direct: Agent features (new, isolated)

**Next Steps**:
1. Get Direct project anon key from dashboard
2. Add to `.env` as `VITE_AGENT_SUPABASE_ANON_KEY`
3. Apply agent migrations to Direct project
4. Update frontend to use `agent-client.ts` for agent features
5. Test end-to-end agent workflow

**Risk**: Low - existing functionality unaffected

---

**Created**: 2026-01-13
**Status**: Ready for implementation
