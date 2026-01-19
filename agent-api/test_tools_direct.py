#!/usr/bin/env python3
"""Test shell and code tools directly in E2B"""
import os, sys, asyncio, json
sys.path.insert(0, '/Users/malena/swiss-ai-vault/agent-api')

async def test():
    from supabase import create_client
    from app.agent.tools.e2b_executor import E2BSandboxExecutor

    print("=" * 80)
    print("Testing E2B Tools Directly")
    print("=" * 80)
    print()

    # Get E2B API key from environment (set in worker)
    e2b_key = os.environ.get('E2B_API_KEY', 'e2b_a33017d32c635bed98c3d164e35cfea71765d3dd')

    executor = E2BSandboxExecutor(e2b_key)

    # Test 1: Shell command
    print("Test 1: Shell - echo and date")
    print("-" * 40)
    result = await executor.execute_shell("echo 'Hello from E2B!' && date && uname -a", timeout=60)
    print(f"Exit code: {result.get('exit_code')}")
    print(f"Stdout:\n{result.get('stdout')}")
    print(f"Stderr: {result.get('stderr')}")
    print()

    # Test 2: Python code
    print("Test 2: Python code - sum and primes")
    print("-" * 40)
    code = """
print('Sum 1-100:', sum(range(1, 101)))
primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
print('First 10 primes:', primes)
"""
    result = await executor.execute_code(code, "python", timeout=60)
    print(f"Success: {result.get('success')}")
    print(f"Output:\n{result.get('output')}")
    print(f"Error: {result.get('error')}")
    print()

    print("=" * 80)
    print("✓ Tests complete - E2B tools are working!")
    print("=" * 80)

asyncio.run(test())
