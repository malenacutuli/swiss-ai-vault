#!/usr/bin/env python3
"""
Quick test script - creates a test job using the API endpoint directly.
No environment variables needed - uses the production API.
"""

import requests
import json
import time

API_URL = "https://api.swissbrain.ai/agent"

# NOTE: You need to provide your auth token here
AUTH_TOKEN = input("Enter your auth token: ").strip()

def create_and_start_job():
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Content-Type": "application/json"
    }

    # Create run
    print("=== Creating test run ===")
    create_payload = {
        "action": "create",
        "prompt": """Check the system information and create a report file.

Steps:
1. Run 'uname -a' to get system info
2. Run 'date' to get current date
3. Run 'echo "System Report" > /tmp/report.txt' to create a file
4. Verify the file was created with 'cat /tmp/report.txt'

Report all results to me."""
    }

    response = requests.post(f"{API_URL}/execute", headers=headers, json=create_payload)
    print(f"Status: {response.status_code}")

    if response.status_code != 200:
        print(f"Error: {response.text}")
        return None

    data = response.json()
    run_id = data.get("run_id")
    print(f"✓ Created run: {run_id}")

    # Start run
    print(f"\n=== Starting run {run_id} ===")
    start_payload = {
        "action": "start",
        "run_id": run_id
    }

    response = requests.post(f"{API_URL}/execute", headers=headers, json=start_payload)
    print(f"Status: {response.status_code}")

    if response.status_code != 200:
        print(f"Error: {response.text}")
        return None

    data = response.json()
    print(f"✓ Started: {data.get('message')}")

    return run_id

def check_status(run_id):
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}",
    }

    print(f"\n=== Checking status for {run_id} ===")
    response = requests.get(f"{API_URL}/runs/{run_id}/status", headers=headers)

    if response.status_code != 200:
        print(f"Error: {response.text}")
        return

    data = response.json()
    print(json.dumps(data, indent=2))

if __name__ == "__main__":
    run_id = create_and_start_job()

    if run_id:
        print(f"\n{'='*60}")
        print(f"✓ Test job created: {run_id}")
        print(f"{'='*60}")
        print("\nWait 90 seconds for AgentSupervisor to:")
        print("  1. Load conversation history (with user prompt!)")
        print("  2. Decide first action using LLM")
        print("  3. Call shell tool via E2B")
        print("  4. Complete the task")
        print(f"\nThen check status:")
        print(f"  python3 QUICK_TEST.py --check {run_id}")

        # Ask if they want to wait and check now
        wait = input("\nWait and check now? (y/n): ").strip().lower()
        if wait == 'y':
            print("\nWaiting 90 seconds...")
            time.sleep(90)
            check_status(run_id)
