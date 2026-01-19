#!/bin/bash
# Try to read worker debug messages from Redis via the API pod (which should have working network)

echo "Checking worker debug messages in Redis..."
echo ""

kubectl exec -n agents deployment/agent-api -- python3 -c "
import redis
import sys

redis_url = 'redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379'

try:
    r = redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=10)

    # Check worker heartbeat
    heartbeat = r.get('worker:heartbeat')
    print(f'Worker heartbeat: {heartbeat or \"NONE\"}')
    print('')

    # Check debug messages
    debug_msgs = r.lrange('worker:debug', 0, 10)
    if debug_msgs:
        print(f'Worker debug messages (last 10):')
        for msg in debug_msgs:
            print(f'  {msg}')
    else:
        print('No worker debug messages found')

    print('')

    # Check queue lengths
    pending = r.llen('jobs:pending')
    processing = r.llen('jobs:processing')
    failed = r.llen('jobs:failed')

    print(f'Queue lengths:')
    print(f'  jobs:pending: {pending}')
    print(f'  jobs:processing: {processing}')
    print(f'  jobs:failed: {failed}')

except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
"
