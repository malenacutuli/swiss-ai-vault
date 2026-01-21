#!/bin/sh
set -e

# Swiss AI Vault Graceful Shutdown Handler
# Handles SIGTERM and SIGINT signals for graceful shutdown

echo "Received shutdown signal..."

# Give the application time to finish current requests
GRACE_PERIOD="${SHUTDOWN_GRACE_PERIOD:-30}"
echo "Waiting ${GRACE_PERIOD}s for graceful shutdown..."

# Send SIGTERM to the main process
if [ -n "$1" ]; then
    kill -TERM "$1" 2>/dev/null || true
fi

# Wait for the grace period
sleep "$GRACE_PERIOD"

# Force kill if still running
if [ -n "$1" ] && kill -0 "$1" 2>/dev/null; then
    echo "Force killing process..."
    kill -KILL "$1" 2>/dev/null || true
fi

echo "Shutdown complete."
exit 0
