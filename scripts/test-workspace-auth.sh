#!/bin/bash
# Test workspace-service authentication
# Run this after logging into the app to test the auth flow

echo "Testing workspace-service authentication..."
echo ""

# Get the current Supabase session from localStorage (you need to export this from browser)
# For now, we'll use curl to test with a token you provide

if [ -z "$1" ]; then
  echo "Usage: ./test-workspace-auth.sh <access_token>"
  echo ""
  echo "To get your access token:"
  echo "1. Open browser DevTools (F12)"
  echo "2. Go to Application > Local Storage > your-app-url"
  echo "3. Find 'sb-rljnrgscmosgkcjdvlrq-auth-token' key"
  echo "4. Copy the access_token value from the JSON"
  exit 1
fi

TOKEN="$1"
FUNCTION_URL="https://ghmmdochvlrnwbruyrqk.supabase.co/functions/v1/workspace-service"

echo "Calling workspace-service with list_workspaces action..."
echo ""

curl -s -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"action": "list_workspaces"}' | jq .

echo ""
echo "Check the Supabase Dashboard for function logs:"
echo "https://supabase.com/dashboard/project/ghmmdochvlrnwbruyrqk/functions/workspace-service/logs"
