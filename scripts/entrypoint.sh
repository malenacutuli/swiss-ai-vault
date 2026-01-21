#!/bin/sh
set -e

# Swiss AI Vault Entrypoint Script
echo "Starting Swiss AI Vault..."

# Wait for dependencies if needed
if [ -n "$DATABASE_URL" ]; then
    echo "Waiting for database connection..."
    sleep 2
fi

# Run database migrations if needed
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running database migrations..."
    npm run db:migrate || true
fi

# Start the application
echo "Starting application server..."
exec node dist/index.js
