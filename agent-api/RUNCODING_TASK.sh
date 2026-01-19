#!/bin/bash
# Run a real coding task through the E2B infrastructure

echo "=== Testing E2B Infrastructure with Real Coding Task ==="
echo ""

# Check if environment variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] || [ -z "$REDIS_URL" ]; then
    echo "❌ Required environment variables not set"
    echo ""
    echo "Please export:"
    echo "  export SUPABASE_URL='...'"
    echo "  export SUPABASE_SERVICE_ROLE_KEY='...'"
    echo "  export REDIS_URL='...'"
    echo ""
    echo "Or run this script from the worker pod which has them:"
    echo "  kubectl cp create_coding_task_simple.py agents/\$(kubectl get pod -n agents -l app=agent-worker -o jsonpath='{.items[0].metadata.name}'):/tmp/"
    echo "  kubectl exec -n agents deployment/agent-worker -- python3 /tmp/create_coding_task_simple.py"
    exit 1
fi

echo "✓ Environment variables found"
echo ""

# Run the task creation script
python3 create_coding_task_simple.py

if [ $? -eq 0 ]; then
    RUN_ID=$(python3 create_coding_task_simple.py | grep "RUN_ID:" | cut -d: -f2)

    echo ""
    echo "✓ Coding task created and enqueued"
    echo ""
    echo "Task: Fibonacci with memoization + performance tests"
    echo "Run ID: $RUN_ID"
    echo ""
    echo "Monitor progress:"
    echo "  watch -n 2 \"python3 check_run_results.py $RUN_ID\""
else
    echo "❌ Failed to create task"
    exit 1
fi
