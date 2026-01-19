# Run Tools Test - Manual Steps

Since environment variables aren't accessible, please run these commands in your terminal:

## Step 1: Deploy Worker (if not already deployed)

```bash
kubectl apply -f k8s/worker-deployment.yaml
kubectl rollout status deployment/agent-worker -n agents
```

## Step 2: Check Worker Status

```bash
kubectl get pods -n agents | grep agent-worker
```

Should show: `agent-worker-xxx  1/1  Running  0  xxs`

## Step 3: Create Test Jobs

Run the test script (with your env vars):

```bash
python3 test_tools.py
```

This will output two Run IDs:
- Shell test ID
- Code test ID

## Step 4: Monitor Results

Wait 30-60 seconds, then check:

```bash
python3 check_coding_task.py
```

Or if you have the Run IDs from step 3:

```bash
python3 check_run_results.py <SHELL_RUN_ID>
python3 check_run_results.py <CODE_RUN_ID>
```

## What to Expect

### Shell Test Should Execute:
- `echo "Hello from E2B shell!"`
- `date`
- `uname -a`
- `pwd`
- `ls -la /workspace`

### Code Test Should Execute:
- Calculate sum 1-100 (result: 5050)
- Generate first 10 prime numbers [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
- Create system info dictionary
- Print all results

## Alternative: Watch Worker Logs Live

```bash
kubectl logs -f -n agents deployment/agent-worker
```

You'll see:
1. Job dequeued from Redis
2. E2B sandbox created
3. "Executing shell command in E2B..." or "Executing python code in E2B..."
4. Results captured
5. Sandbox killed
6. Job marked complete
