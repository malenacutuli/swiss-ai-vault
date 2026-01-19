# Setup Test Credentials

You need Supabase credentials to run the tests. Here are your options:

## Option 1: Get from K8s (if kubectl works)

```bash
export SUPABASE_URL=$(kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.SUPABASE_URL}' | base64 -d)
export SUPABASE_SERVICE_ROLE_KEY=$(kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.SUPABASE_SERVICE_ROLE_KEY}' | base64 -d)
```

Then test:
```bash
python3 test_v2_direct.py
```

## Option 2: Manual Setup (if kubectl doesn't work)

**Get credentials from:**
- Your Supabase dashboard (https://app.supabase.com)
- Or from someone who has kubectl access to the cluster
- Or from your secure credential store

**Then set them:**
```bash
export SUPABASE_URL='https://your-project.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='eyJhbGc...'  # Service role key (not anon key!)
```

**Test:**
```bash
python3 test_v2_direct.py
```

## Option 3: Check What the Bug Was (Without Creating New Run)

If you just want to verify the bug existed in the old run:

```bash
# Set credentials first (one of the methods above)
python3 check_previous_run.py
```

This will check run `051d425a-f4af-4e74-9489-0aaa724aa5fe` and show:
- ❌ No conversation history (the bug)
- ✓ Confirms v2 fix is needed

## Troubleshooting

**If you get "Missing environment variables":**
- The credentials aren't set in your current terminal session
- Run one of the export commands above again

**If you get "foreign key constraint" error:**
- The database requires a real user ID
- The script will automatically use an existing user
- If no users exist, you need to create one first

**If kubectl is not connected:**
- Get credentials from Supabase dashboard
- Or use Option 2 (manual setup)

## Once Credentials Are Set

**Create and test a new run:**
```bash
python3 test_v2_direct.py
```

**Check an existing run:**
```bash
python3 test_v2_direct.py <RUN_ID>
```

**Check the old failed run:**
```bash
python3 check_previous_run.py
```
