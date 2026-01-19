#!/bin/bash
# Deploy all Manus-parity edge functions to Supabase
# Usage: ./scripts/deploy-edge-functions.sh [--token YOUR_TOKEN]

set -e

PROJECT_REF="ghmmdochvlrnwbruyrqk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions to deploy (in order of priority)
CORE_FUNCTIONS=(
  "workspace-service"
  "custom-agents"
  "run-service"
  "billing-service"
)

INTEGRATION_FUNCTIONS=(
  "email-action"
  "calendar-action"
  "slack-action"
  "github-action"
  "notion-action"
)

AI_FUNCTIONS=(
  "deep-research"
  "ghost-inference"
  "agent-execute"
  "agent-status"
  "agent-logs"
)

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     SwissBrain Edge Function Deployment Script            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Parse arguments
TOKEN=""
DEPLOY_ALL=false
CATEGORY="core"

while [[ $# -gt 0 ]]; do
  case $1 in
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --all)
      DEPLOY_ALL=true
      shift
      ;;
    --category)
      CATEGORY="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --token TOKEN    Supabase access token (or set SUPABASE_ACCESS_TOKEN env var)"
      echo "  --all            Deploy all functions (core + integrations + AI)"
      echo "  --category CAT   Deploy specific category: core, integrations, ai"
      echo "  --help           Show this help message"
      echo ""
      echo "Categories:"
      echo "  core         - workspace-service, custom-agents, run-service, billing-service"
      echo "  integrations - email, calendar, slack, github, notion actions"
      echo "  ai           - deep-research, ghost-inference, agent-execute/status/logs"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Check for token
if [ -z "$TOKEN" ]; then
  TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
fi

if [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}No token provided. Attempting to use existing login...${NC}"
  echo ""

  # Check if already logged in
  if ! npx supabase projects list &>/dev/null; then
    echo -e "${RED}Not logged in to Supabase CLI.${NC}"
    echo ""
    echo "Please either:"
    echo "  1. Login first:  npx supabase login"
    echo "  2. Provide token: $0 --token YOUR_TOKEN"
    echo ""
    echo "Get your token at: https://supabase.com/dashboard/account/tokens"
    exit 1
  fi
else
  echo -e "${BLUE}Logging in with provided token...${NC}"
  echo "$TOKEN" | npx supabase login --token "$TOKEN" 2>/dev/null || {
    # Token might already be set, continue
    true
  }
fi

# Select functions to deploy
FUNCTIONS_TO_DEPLOY=()

if [ "$DEPLOY_ALL" = true ]; then
  FUNCTIONS_TO_DEPLOY=("${CORE_FUNCTIONS[@]}" "${INTEGRATION_FUNCTIONS[@]}" "${AI_FUNCTIONS[@]}")
  echo -e "${BLUE}Deploying ALL functions...${NC}"
else
  case $CATEGORY in
    core)
      FUNCTIONS_TO_DEPLOY=("${CORE_FUNCTIONS[@]}")
      echo -e "${BLUE}Deploying CORE functions...${NC}"
      ;;
    integrations)
      FUNCTIONS_TO_DEPLOY=("${INTEGRATION_FUNCTIONS[@]}")
      echo -e "${BLUE}Deploying INTEGRATION functions...${NC}"
      ;;
    ai)
      FUNCTIONS_TO_DEPLOY=("${AI_FUNCTIONS[@]}")
      echo -e "${BLUE}Deploying AI functions...${NC}"
      ;;
    *)
      FUNCTIONS_TO_DEPLOY=("${CORE_FUNCTIONS[@]}")
      echo -e "${BLUE}Deploying CORE functions (default)...${NC}"
      ;;
  esac
fi

echo ""
echo -e "${BLUE}Project: ${NC}${PROJECT_REF}"
echo -e "${BLUE}Functions to deploy: ${NC}${#FUNCTIONS_TO_DEPLOY[@]}"
echo ""

# Track results
DEPLOYED=()
FAILED=()

cd "$PROJECT_DIR"

for func in "${FUNCTIONS_TO_DEPLOY[@]}"; do
  FUNC_PATH="supabase/functions/$func"

  if [ ! -d "$FUNC_PATH" ]; then
    echo -e "${YELLOW}⚠ Skipping $func - directory not found${NC}"
    continue
  fi

  echo -e "${BLUE}▶ Deploying ${NC}${func}${BLUE}...${NC}"

  if npx supabase functions deploy "$func" --project-ref "$PROJECT_REF" 2>&1; then
    echo -e "${GREEN}✓ $func deployed successfully${NC}"
    DEPLOYED+=("$func")
  else
    echo -e "${RED}✗ $func failed to deploy${NC}"
    FAILED+=("$func")
  fi

  echo ""
done

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    DEPLOYMENT SUMMARY                      ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ ${#DEPLOYED[@]} -gt 0 ]; then
  echo -e "${GREEN}Successfully deployed (${#DEPLOYED[@]}):${NC}"
  for func in "${DEPLOYED[@]}"; do
    echo -e "  ${GREEN}✓${NC} $func"
  done
  echo ""
fi

if [ ${#FAILED[@]} -gt 0 ]; then
  echo -e "${RED}Failed to deploy (${#FAILED[@]}):${NC}"
  for func in "${FAILED[@]}"; do
    echo -e "  ${RED}✗${NC} $func"
  done
  echo ""
  echo -e "${YELLOW}Tip: Check function logs with:${NC}"
  echo "  npx supabase functions logs <function-name> --project-ref $PROJECT_REF"
  exit 1
fi

echo -e "${GREEN}All functions deployed successfully!${NC}"
echo ""
echo -e "${BLUE}Test URLs:${NC}"
echo "  https://${PROJECT_REF}.supabase.co/functions/v1/workspace-service"
echo "  https://${PROJECT_REF}.supabase.co/functions/v1/custom-agents"
echo "  https://${PROJECT_REF}.supabase.co/functions/v1/run-service"
echo ""
echo -e "${GREEN}Done!${NC}"
