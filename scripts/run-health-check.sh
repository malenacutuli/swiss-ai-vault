#!/bin/bash
# SwissBrain.ai Baseline Health Check Runner
# Usage: ./scripts/run-health-check.sh [environment]
# Environment: local (default), staging, production

set -e

ENVIRONMENT=${1:-local}

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         SwissBrain.ai Baseline Health Check                  ║"
echo "║         Environment: ${ENVIRONMENT}"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Load environment variables based on environment
case $ENVIRONMENT in
  local)
    if [ -f .env.local ]; then
      export $(cat .env.local | grep -v '^#' | xargs)
    else
      echo "⚠️  .env.local not found. Using system environment variables."
    fi
    ;;
  staging)
    if [ -f .env.staging ]; then
      export $(cat .env.staging | grep -v '^#' | xargs)
    else
      echo "❌ .env.staging not found"
      exit 1
    fi
    ;;
  production)
    if [ -f .env.production ]; then
      export $(cat .env.production | grep -v '^#' | xargs)
    else
      echo "❌ .env.production not found"
      exit 1
    fi
    ;;
  *)
    echo "❌ Unknown environment: $ENVIRONMENT"
    echo "Usage: $0 [local|staging|production]"
    exit 1
    ;;
esac

# Check required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ Missing required environment variables:"
  echo "   SUPABASE_URL and SUPABASE_ANON_KEY must be set"
  exit 1
fi

echo "🔍 Running tests against: $SUPABASE_URL"
echo ""

# Run the tests
deno test \
  --allow-net \
  --allow-env \
  --fail-fast \
  supabase/functions/_tests/baseline-health.test.ts

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All health checks passed!"
  echo ""
  echo "Safe to proceed with changes."
else
  echo "❌ Health checks failed!"
  echo ""
  echo "DO NOT DEPLOY until all tests pass."
  echo "If tests were passing before your changes, REVERT immediately."
fi

exit $EXIT_CODE
