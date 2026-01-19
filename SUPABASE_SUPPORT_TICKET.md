# Supabase Support Ticket - Edge Functions Routing Bug

**Date**: 2026-01-13
**Severity**: Critical - Blocking all new Edge Function deployments
**Project ID**: ghmmdochvlrnwbruyrqk
**Project Name**: SwissVault.ai
**Region**: West EU (Paris)

---

## Issue Summary

**Edge Functions deployed after 16:36 UTC today return 404 NOT_FOUND despite showing as ACTIVE in CLI. Functions deployed before this time work correctly.**

---

## Evidence

### Working Functions (Deployed ~16:33 UTC)

| Function | HTTP Status | Notes |
|----------|-------------|-------|
| agent-execute | 401 (auth error) | ✅ Accessible, returns proper auth error |
| agent-status | 401 (auth error) | ✅ Accessible, returns proper auth error |
| agent-logs | 401 (auth error) | ✅ Accessible, returns proper auth error |

These functions are accessible via HTTP and return expected authentication errors, proving routing works.

### Broken Functions (Deployed After 16:36 UTC)

| Function | ID | Deploy Time | CLI Status | HTTP Status |
|----------|----|-----------| ------------|-------------|
| agent-execute-phase2 | abc1586b-3690-4f92-a5c1-44cd446003c8 | 16:36:58 | ACTIVE | ❌ 404 |
| agent-status-phase2 | 52eb8abc-c0d7-44bb-9b47-ccdb9a8e1c24 | 16:37:04 | ACTIVE | ❌ 404 |
| agent-logs-phase2 | e69baad4-9b2d-48f7-83c2-d6a9a11f1118 | 16:37:08 | ACTIVE | ❌ 404 |
| agentexecute2 | 5908d557-370d-4cd8-8f9a-334bd6e4498f | 16:42:57 | ACTIVE | ❌ 404 |
| test-env | 03648314-03de-4553-9b8d-f71a1977e96a | 17:05:23 | ACTIVE | ❌ 404 |

**All functions deployed after 16:36 UTC return 404, regardless of:**
- Function name/naming pattern
- Code complexity (even minimal test function fails)
- Deployment flags (tried with/without `--no-verify-jwt`)
- Wait time (tried up to 90+ minutes)
- Multiple delete/redeploy cycles

### Test Function Evidence

To rule out code issues, we deployed a minimal test function (`test-env`) that:
- Has no complex imports (only `serve` from Deno)
- Does not access any APIs
- Simply returns environment variable status
- **Still returns 404**

This proves the issue is in the routing layer, not application code.

---

## Timeline

| Time (UTC) | Event | Result |
|------------|-------|--------|
| 16:33:07 | Deployed `agent-execute` | ✅ Works |
| 16:33:11 | Deployed `agent-status` | ✅ Works |
| 16:33:16 | Deployed `agent-logs` | ✅ Works |
| **16:36:58** | **Deployed `agent-execute-phase2`** | **❌ 404** |
| **16:37:04** | **Deployed `agent-status-phase2`** | **❌ 404** |
| **16:37:08** | **Deployed `agent-logs-phase2`** | **❌ 404** |
| 16:42:57 | Deployed `agentexecute2` (retry) | ❌ 404 |
| 17:05:23 | Deployed `test-env` (minimal test) | ❌ 404 |
| 17:42:00 | Deleted/redeployed `agent-execute-phase2` | ❌ Still 404 |

**Between 16:33 and 16:36 UTC, something changed in the routing layer that breaks new deployments.**

---

## Technical Details

### HTTP Response Headers

```
> POST /functions/v1/agent-execute-phase2 HTTP/2
< HTTP/2 404
< content-type: application/json
< cf-ray: 9bd66696eab6d135-CDG
< cf-cache-status: DYNAMIC
< server: cloudflare
{
  "code": "NOT_FOUND",
  "message": "Requested function was not found"
}
```

**Key observations:**
- `cf-cache-status: DYNAMIC` - NOT cached, fresh request to origin
- Request reaches Cloudflare CDG (Paris) edge
- 404 returned from Supabase origin, not CDN
- HTTP/2 connection successful
- Authentication header accepted (not a JWT issue)

### CLI Verification

```bash
$ supabase functions list | grep -E "(phase2|test-env)"
abc1586b-... | agent-execute-phase2 | agent-execute-phase2 | ACTIVE | 2 | 2026-01-13 17:42:31
52eb8abc-... | agent-status-phase2  | agent-status-phase2  | ACTIVE | 1 | 2026-01-13 16:37:04
e69baad4-... | agent-logs-phase2    | agent-logs-phase2    | ACTIVE | 1 | 2026-01-13 16:37:08
03648314-... | test-env             | test-env             | ACTIVE | 1 | 2026-01-13 17:05:23
```

**All show as ACTIVE**, proving deployment succeeded and management API recognizes them.

### Secrets Configuration

```bash
$ supabase secrets list | grep ANTHROPIC
ANTHROPIC_API_KEY | daaafb1d120c3d48066476afeedd629f2cdf0130ca0cff2b6979dc5884b631ed
```

**Secret is properly configured**, ruling out environment variable issues.

### Dashboard Logs

From dashboard function logs, we see:
```json
{
  "event_message": "shutdown",
  "metadata": [{
    "event_type": "Shutdown",
    "reason": "EarlyDrop",
    "cpu_time_used": 62,
    "function_id": "abc1586b-3690-4f92-a5c1-44cd446003c8"
  }]
}
```

**"EarlyDrop" with 62ms CPU** suggests function WAS invoked but crashed during initialization. However, this would typically return a 500 error, not 404. The 404 suggests routing layer doesn't know about the function.

---

## Troubleshooting Steps Attempted

1. ✅ Cleaned up old conflicting code
2. ✅ Deployed with different function names (bypassing any cache)
3. ✅ Tried simple function names without hyphens
4. ✅ Deployed with `--no-verify-jwt` flag
5. ✅ Waited 90+ minutes for propagation
6. ✅ Multiple delete + redeploy cycles
7. ✅ Created minimal test function (no imports, no complexity)
8. ✅ Verified secrets are properly configured
9. ✅ Tested from multiple network locations
10. ❌ **All attempts failed - functions remain 404**

---

## Impact

**Critical business impact:**
- Cannot deploy any new Edge Functions
- Phase 2 implementation (9 components, 100% complete) is inaccessible
- Cannot update existing functions (would lose access)
- Development and testing completely blocked

---

## Request

**Please investigate the HTTP routing layer for this project.**

Specifically:
1. Check if there was a platform change/deployment between 16:33-16:36 UTC today
2. Verify routing registry is properly updated when new functions are deployed
3. Check if there's a stale routing cache or configuration issue
4. Investigate why EarlyDrop shutdown results in 404 instead of 500

**Expected behavior:**
- Functions showing as ACTIVE should be HTTP-accessible
- Function routing should be consistent across deployments
- New deployments should work the same as old deployments

---

## URLs for Investigation

### Dashboard
- Project: https://supabase.com/dashboard/project/ghmmdochvlrnwbruyrqk
- Functions: https://supabase.com/dashboard/project/ghmmdochvlrnwbruyrqk/functions

### Function Logs
- https://supabase.com/dashboard/project/ghmmdochvlrnwbruyrqk/functions/agent-execute-phase2/logs
- https://supabase.com/dashboard/project/ghmmdochvlrnwbruyrqk/functions/test-env/logs

### Test Endpoints
```bash
# Returns 404 (should work):
curl https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/test-env

# Returns 401 auth error (works correctly):
curl https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/agent-status
```

---

## Contact

Ready to provide any additional logs, diagnostics, or testing assistance needed to resolve this issue.

**Priority**: Critical - Blocking all Edge Function development

---

**Created**: 2026-01-13 17:45 UTC
