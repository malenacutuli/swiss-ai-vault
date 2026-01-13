# SwissBrain.ai Test Suite

## Purpose

This test suite ensures that all existing SwissBrain.ai functionality continues to work correctly as we add new features. It serves as a safety net to catch regressions early.

## Test Files

### `baseline-health.test.ts`
Comprehensive health check that verifies:
- **Critical Paths**: Chat, Ghost AI, credits, analytics
- **Agent Infrastructure**: Agent execution, status, logs
- **Database**: Core tables (users, conversations, organizations)
- **Document Generation**: PDF, PPTX, slides
- **Recent Features**: Scheduler, Stripe, embeddings, voice, images
- **Schema Integrity**: All tables exist and are accessible
- **OAuth**: Connector integrations

## Running Tests

### Prerequisites
```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
```

### Run All Tests
```bash
deno test --allow-net --allow-env supabase/functions/_tests/
```

### Run Specific Test File
```bash
deno test --allow-net --allow-env supabase/functions/_tests/baseline-health.test.ts
```

### Run with Verbose Output
```bash
deno test --allow-net --allow-env --trace-ops supabase/functions/_tests/
```

## Test Strategy

### BEFORE Changes
1. Run baseline health check
2. Verify ALL tests pass
3. Document baseline state

### AFTER Changes
1. Run baseline health check again
2. Compare results with baseline
3. **If ANY test fails**: REVERT immediately
4. Investigate failure before re-attempting

## Test Expectations

### Success Criteria
- ✅ All endpoints return non-404 status
- ✅ All endpoints return non-500 status
- ✅ All tables are queryable (even if RLS blocks data)
- ✅ Database connectivity works

### Expected Failures (OK)
- 401 Unauthorized (RLS blocking anonymous access)
- 400 Bad Request (invalid test data)

### Critical Failures (REVERT)
- 404 Not Found (endpoint/table missing)
- 500 Internal Server Error (code broken)
- Connection refused (service down)

## Adding New Tests

When adding new features:

1. **Add corresponding health check** to `baseline-health.test.ts`
2. **Use safe patterns**:
   ```typescript
   Deno.test("NEW: my-feature endpoint exists", async () => {
     const response = await apiCall("my-feature", { method: "POST", body: "{}" });
     assertEquals(response.status !== 404, true, "my-feature should exist");
   });
   ```
3. **Test table existence**:
   ```typescript
   Deno.test("SCHEMA: my_table exists", async () => {
     const response = await fetch(`${SUPABASE_URL}/rest/v1/my_table?select=id&limit=1`, {
       headers: { "apikey": SUPABASE_ANON_KEY }
     });
     assertEquals(response.status !== 404, true, "my_table should exist");
   });
   ```

## CI/CD Integration

### GitHub Actions (Future)
```yaml
name: Baseline Health Check
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
      - run: deno test --allow-net --allow-env supabase/functions/_tests/
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

### Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit
deno test --allow-net --allow-env supabase/functions/_tests/
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Commit aborted."
  exit 1
fi
```

## Troubleshooting

### Tests Failing Locally
1. Check environment variables are set
2. Verify Supabase project is running
3. Check network connectivity
4. Review Supabase logs for errors

### Tests Pass Locally But Fail in Production
1. Check production environment variables
2. Verify migrations have been applied
3. Check edge function deployment status
4. Review production logs

## Contact

For test failures or questions, review:
- Supabase Edge Function logs
- Database migration history
- Recent commits to main branch
