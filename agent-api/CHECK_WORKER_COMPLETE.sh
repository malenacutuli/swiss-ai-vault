#!/bin/bash
# Check worker status - needs Redis URL

echo "To check worker status, I need the Redis URL."
echo ""
echo "Get it from K8s:"
echo "  kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.REDIS_URL}' | base64 -d"
echo ""
echo "Then run:"
echo "  export REDIS_URL='your_redis_url'"
echo "  python3 check_worker_status.py"
echo ""
echo "This will show:"
echo "  - Worker debug messages (is it running?)"
echo "  - Queue depths (are jobs being enqueued?)"
echo "  - Last worker start time"
