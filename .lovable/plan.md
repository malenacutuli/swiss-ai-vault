
# Plan: Dual Database Persistence for HELIOS Sessions

## Problem Summary

HELIOS sessions are being stored in the **dev project database** (`ghmmdochvlrnwbruyrqk`) but the frontend sometimes queries **Lovable Cloud** (`rljnrgscmosgkcjdvlrq`). The Lovable Cloud `helios_sessions` table is currently empty.

---

## Solution: Save to Both Databases

Modify the `helios-chat` edge function on Lovable Cloud to save session data to **both** Supabase projects, ensuring data is available regardless of which database is queried.

---

## Implementation Steps

### Step 1: Update helios-chat Edge Function

Add dual-write logic to create, update, and complete operations:

```text
supabase/functions/helios-chat/index.ts

Add at the top:
- Create a second Supabase client for the dev project
- Use environment variables for dev project credentials

For each database operation (create, message, complete_session):
- Write to the primary (Lovable Cloud) database first
- Then mirror the same operation to the dev project database
- Log any sync failures but don't block the main operation
```

### Step 2: Add Dev Project Secrets

Configure environment variables for the edge function:
- `DEV_SUPABASE_URL`: `https://ghmmdochvlrnwbruyrqk.supabase.co`
- `DEV_SUPABASE_SERVICE_ROLE_KEY`: Service role key for dev project

### Step 3: Update ConsultsPage to Query Both

Modify ConsultsPage to try Lovable Cloud first, then fall back to dev project:

```text
src/components/helios/pages/ConsultsPage.tsx

1. First, query Lovable Cloud via main supabase client
2. If empty or error, fall back to dev project client
3. Merge results if both have data (dedupe by session_id)
```

### Step 4: Update useHeliosChat to Use Lovable Cloud

Change the import to use the main Supabase client for consistency:

```text
src/hooks/helios/useHeliosChat.ts

Change:
  import { supabase } from '@/lib/supabase';
To:
  import { supabase } from '@/integrations/supabase/client';
```

This ensures new sessions go to Lovable Cloud (which will mirror to dev).

---

## Technical Details

### Edge Function Changes

```typescript
// Create dev project client
const devSupabaseUrl = Deno.env.get("DEV_SUPABASE_URL") || "https://ghmmdochvlrnwbruyrqk.supabase.co";
const devSupabaseKey = Deno.env.get("DEV_SUPABASE_SERVICE_ROLE_KEY");

const devSupabase = devSupabaseKey 
  ? createClient(devSupabaseUrl, devSupabaseKey)
  : null;

// Helper function to sync to dev
async function syncToDevProject(table: string, operation: 'insert' | 'update', data: any, matchColumn?: string, matchValue?: string) {
  if (!devSupabase) return;
  
  try {
    if (operation === 'insert') {
      await devSupabase.from(table).insert(data);
    } else if (operation === 'update' && matchColumn && matchValue) {
      await devSupabase.from(table).update(data).eq(matchColumn, matchValue);
    }
    console.log(`[HELIOS] Synced to dev project: ${table} ${operation}`);
  } catch (err) {
    console.error(`[HELIOS] Dev sync failed:`, err);
    // Don't throw - dev sync is best-effort
  }
}
```

### Files to Modify

1. **supabase/functions/helios-chat/index.ts**
   - Add dev project client initialization
   - Add sync helper function
   - Add sync calls after each primary operation (create, message, complete)

2. **src/hooks/helios/useHeliosChat.ts**
   - Change supabase import to use main client
   - This ensures consistency with Lovable Cloud

3. **src/components/helios/pages/ConsultsPage.tsx**
   - Add fallback query to dev project
   - Merge and deduplicate results

### Required Secrets

You will need to add these secrets to the Lovable Cloud project:
- `DEV_SUPABASE_URL` (optional, can be hardcoded)
- `DEV_SUPABASE_SERVICE_ROLE_KEY` (required for writes to dev)

---

## Benefits

1. **Redundancy** - Data exists in both projects
2. **Backwards compatibility** - Old sessions from dev project are still accessible
3. **Forward consistency** - New sessions are in both places
4. **Gradual migration** - Can eventually move to single project if desired

---

## Summary

This plan adds dual-write capability to the HELIOS edge function, ensuring sessions are persisted to both the Lovable Cloud and dev Supabase projects. The ConsultsPage will query both sources and merge results, guaranteeing users always see their consultation history regardless of which database originally stored it.
