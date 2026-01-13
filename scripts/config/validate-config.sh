#!/bin/bash
#
# Configuration Validation Script
# Validates Kubernetes ConfigMaps and Secrets before deployment
#
# Usage: ./validate-config.sh [environment]
# Environment: development, staging, production
#

set -e

ENVIRONMENT="${1:-development}"
NAMESPACE="swissbrain"
ERRORS=0
WARNINGS=0

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     SwissBrain AI - Configuration Validator              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Namespace: $NAMESPACE"
echo ""

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

error() {
  echo -e "${RED}✗ ERROR: $1${NC}"
  ((ERRORS++))
}

warning() {
  echo -e "${YELLOW}⚠ WARNING: $1${NC}"
  ((WARNINGS++))
}

success() {
  echo -e "${GREEN}✓ $1${NC}"
}

info() {
  echo "ℹ $1"
}

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
  error "kubectl is not installed or not in PATH"
  exit 1
fi

# Check if namespace exists
if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
  warning "Namespace '$NAMESPACE' does not exist"
fi

# Validate ConfigMap file exists
CONFIGMAP_FILE="k8s/config/configmap-${ENVIRONMENT}.yaml"
if [ ! -f "$CONFIGMAP_FILE" ]; then
  error "ConfigMap file not found: $CONFIGMAP_FILE"
  exit 1
fi
success "ConfigMap file found: $CONFIGMAP_FILE"

# Validate YAML syntax
if ! kubectl apply --dry-run=client -f "$CONFIGMAP_FILE" &> /dev/null; then
  error "ConfigMap YAML is invalid"
else
  success "ConfigMap YAML is valid"
fi

# Check required environment variables
echo ""
info "Checking required configuration variables..."

REQUIRED_VARS=(
  "NODE_ENV"
  "ENVIRONMENT"
  "LOG_LEVEL"
  "APP_URL"
  "API_URL"
  "REDIS_HOST"
  "REDIS_PORT"
)

for var in "${REQUIRED_VARS[@]}"; do
  if grep -q "$var:" "$CONFIGMAP_FILE"; then
    success "Found: $var"
  else
    error "Missing required variable: $var"
  fi
done

# Environment-specific checks
echo ""
info "Performing environment-specific checks..."

case "$ENVIRONMENT" in
  production)
    # Production-specific validations
    if grep -q 'DEBUG: "true"' "$CONFIGMAP_FILE"; then
      error "DEBUG should be false in production"
    fi

    if grep -q 'LOG_LEVEL: "debug"' "$CONFIGMAP_FILE"; then
      warning "LOG_LEVEL should not be 'debug' in production"
    fi

    if grep -q 'SESSION_SECURE: "false"' "$CONFIGMAP_FILE"; then
      error "SESSION_SECURE must be true in production"
    fi

    if grep -q 'CORS_ORIGIN: "\*"' "$CONFIGMAP_FILE"; then
      error "CORS_ORIGIN should not be '*' in production"
    fi

    success "Production environment checks passed"
    ;;

  staging)
    if grep -q 'DEBUG: "true"' "$CONFIGMAP_FILE"; then
      warning "DEBUG is enabled in staging"
    fi
    success "Staging environment checks passed"
    ;;

  development)
    success "Development environment checks passed"
    ;;

  *)
    error "Unknown environment: $ENVIRONMENT"
    ;;
esac

# Check for common misconfigurations
echo ""
info "Checking for common misconfigurations..."

if grep -q 'localhost' "$CONFIGMAP_FILE" && [ "$ENVIRONMENT" != "development" ]; then
  warning "Found 'localhost' in $ENVIRONMENT environment"
fi

if grep -q 'http://' "$CONFIGMAP_FILE" && [ "$ENVIRONMENT" = "production" ]; then
  warning "Found 'http://' URLs in production (should use https://)"
fi

# Check secrets exist (if cluster is accessible)
echo ""
info "Checking secrets in cluster..."

if kubectl get namespace "$NAMESPACE" &> /dev/null; then
  REQUIRED_SECRETS=(
    "supabase-secrets"
    "api-keys"
  )

  for secret in "${REQUIRED_SECRETS[@]}"; do
    if kubectl get secret "$secret" -n "$NAMESPACE" &> /dev/null; then
      success "Secret exists: $secret"
    else
      warning "Secret not found: $secret (may need to be created)"
    fi
  done
else
  warning "Cannot check secrets - namespace not accessible"
fi

# Summary
echo ""
echo "════════════════════════════════════════════════════════════"
echo "                   Validation Summary"
echo "════════════════════════════════════════════════════════════"
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"
echo ""

if [ $ERRORS -gt 0 ]; then
  error "Validation failed with $ERRORS error(s)"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  warning "Validation passed with $WARNINGS warning(s)"
  exit 0
else
  success "Validation passed successfully!"
  exit 0
fi
