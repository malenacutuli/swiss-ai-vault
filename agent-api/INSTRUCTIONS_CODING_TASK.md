# Test E2B Infrastructure with Real Coding Task

## Option 1: Run from Worker Pod (Recommended)

```bash
# Copy the script to the worker pod
kubectl cp create_coding_task_simple.py \
  agents/$(kubectl get pod -n agents -l app=agent-worker -o jsonpath='{.items[0].metadata.name}'):/tmp/

# Execute it (worker has all env vars)
kubectl exec -n agents deployment/agent-worker -- \
  python3 /tmp/create_coding_task_simple.py

# You'll get output like: RUN_ID:abc-123-def-456

# Monitor the execution
kubectl logs -f -n agents deployment/agent-worker

# Check results (replace RUN_ID with actual value)
python3 check_run_results.py <RUN_ID>
```

## Option 2: Run Locally

If you have the environment variables exported:

```bash
# Verify env vars are set
echo $SUPABASE_URL
echo $REDIS_URL

# Run the script
python3 create_coding_task_simple.py

# Monitor and check results
python3 check_run_results.py <RUN_ID>
```

## What the Test Will Do

The coding task asks the E2B sandbox to:
1. Create a Fibonacci function using dynamic programming (memoization)
2. Write test cases for numbers 0-10
3. Compare performance between recursive and memoized approaches

This tests:
- ✓ E2B sandbox Python code execution
- ✓ Real algorithm implementation
- ✓ Test generation capabilities
- ✓ Performance analysis
- ✓ Full agent planning + execution flow

## Expected Result

The E2B sandbox should:
1. Plan the implementation approach
2. Generate Python code with memoized Fibonacci
3. Create test cases
4. Run performance comparisons
5. Return comprehensive results

Execution time: ~1-2 minutes
