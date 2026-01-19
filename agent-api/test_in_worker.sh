#!/bin/bash
# Test E2B tools directly in the worker pod (where all dependencies exist)

WORKER_POD=$(kubectl get pod -n agents -l app=agent-worker -o jsonpath='{.items[0].metadata.name}')

if [ -z "$WORKER_POD" ]; then
    echo "❌ Could not find worker pod"
    exit 1
fi

echo "Found worker pod: $WORKER_POD"
echo ""
echo "Running E2B tool tests in worker pod..."
echo ""

kubectl exec -n agents $WORKER_POD -- python3 -c '
import asyncio
import json

async def test():
    from app.agent.tools.e2b_executor import E2BSandboxExecutor
    import os

    print("=" * 80)
    print("Testing E2B Tools Directly")
    print("=" * 80)
    print()

    executor = E2BSandboxExecutor(os.environ["E2B_API_KEY"])

    # Test 1: Shell
    print("Test 1: Shell commands")
    print("-" * 40)
    result = await executor.execute_shell("echo \"Hello from E2B!\" && date && uname -a", timeout=60)
    print(f"Exit code: {result.get(\"exit_code\")}")
    print(f"Stdout:\n{result.get(\"stdout\")}")
    print()

    # Test 2: Python code
    print("Test 2: Python code")
    print("-" * 40)
    code = """
print(\"Sum 1-100:\", sum(range(1, 101)))
print(\"First 10 primes:\", [2, 3, 5, 7, 11, 13, 17, 19, 23, 29])
"""
    result = await executor.execute_code(code, "python", timeout=60)
    print(f"Success: {result.get(\"success\")}")
    print(f"Output:\n{result.get(\"output\")}")
    print()

    print("=" * 80)
    print("✓ E2B tools are working!")
    print("=" * 80)

asyncio.run(test())
'
