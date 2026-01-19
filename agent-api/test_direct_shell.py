#!/usr/bin/env python3
"""Test shell tool directly by calling the worker's tool router"""
import os, sys, asyncio, json
from datetime import datetime

sys.path.insert(0, '/Users/malena/swiss-ai-vault/agent-api')

async def test_shell_tool():
    """Test shell execution directly through ToolRouter"""
    from app.config import get_settings
    from supabase import create_client
    from app.agent.tools.router import ToolRouter
    from app.agent.models.types import ToolContext

    settings = get_settings()
    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

    # Create tool router
    router = ToolRouter(supabase)

    # Create context
    context = ToolContext(
        run_id="test-run-123",
        user_id="ad7d2f6d-3292-47ea-b1ad-75388539e89e",
        step_id="test-step-1"
    )

    print("=" * 80)
    print("Testing E2B Shell Tool Directly")
    print("=" * 80)
    print()

    # Test 1: Simple echo
    print("Test 1: echo command")
    print("-" * 40)
    result = await router.execute(
        tool_name="shell",
        input_data={
            "command": "echo 'Hello from E2B!'"
        },
        context=context
    )

    print(f"Success: {result.success}")
    print(f"Output: {json.dumps(result.output, indent=2)}")
    print(f"Error: {result.error}")
    print()

    # Test 2: Multiple commands
    print("Test 2: Date and system info")
    print("-" * 40)
    result = await router.execute(
        tool_name="shell",
        input_data={
            "command": "date && uname -a"
        },
        context=context
    )

    print(f"Success: {result.success}")
    if result.success:
        print(f"stdout: {result.output.get('stdout')}")
        print(f"stderr: {result.output.get('stderr')}")
        print(f"exit_code: {result.output.get('exit_code')}")
    else:
        print(f"Error: {result.error}")
    print()

    # Test 3: Python code
    print("Test 3: Python code execution")
    print("-" * 40)
    result = await router.execute(
        tool_name="code",
        input_data={
            "language": "python",
            "code": "print('Sum 1-100:', sum(range(1, 101)))\nprint('First 10 primes:', [2, 3, 5, 7, 11, 13, 17, 19, 23, 29])"
        },
        context=context
    )

    print(f"Success: {result.success}")
    print(f"Output: {json.dumps(result.output, indent=2)}")
    print(f"Error: {result.error}")
    print()

    print("=" * 80)
    print("✓ Direct tool test complete")
    print("=" * 80)

if __name__ == "__main__":
    try:
        asyncio.run(test_shell_tool())
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
