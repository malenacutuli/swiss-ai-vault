#!/bin/sh
set -e

# Swiss AI Vault Health Check Script
# Returns 0 if healthy, 1 if unhealthy

HEALTH_URL="${HEALTH_CHECK_URL:-http://localhost:3000/health}"

# Check if the server is responding
response=$(curl -sf "$HEALTH_URL" 2>/dev/null) || exit 1

# Check if response indicates healthy status
if echo "$response" | grep -q "ok\|healthy\|true"; then
    exit 0
fi

exit 1
