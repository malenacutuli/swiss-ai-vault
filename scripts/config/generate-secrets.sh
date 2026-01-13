#!/bin/bash
#
# Generate Secrets Script
# Generates secure random values for Kubernetes secrets
#
# Usage: ./generate-secrets.sh [output-file]
#

set -e

OUTPUT_FILE="${1:-secrets-generated.yaml}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║          SwissBrain AI - Secret Generator                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Function to generate random string
generate_random() {
  openssl rand -base64 "$1" | tr -d '\n'
}

# Function to generate hex string
generate_hex() {
  openssl rand -hex "$1" | tr -d '\n'
}

# Generate secrets
echo "Generating secrets..."

JWT_SECRET=$(generate_random 64)
JWT_REFRESH_SECRET=$(generate_random 64)
REDIS_PASSWORD=$(generate_random 32)
ENCRYPTION_KEY=$(generate_hex 32)
ENCRYPTION_SALT=$(generate_hex 16)
SESSION_SECRET=$(generate_random 48)

echo "✓ JWT secrets generated"
echo "✓ Redis password generated"
echo "✓ Encryption keys generated"
echo "✓ Session secret generated"
echo ""

# Create YAML file
cat > "$OUTPUT_FILE" <<EOF
# Auto-generated secrets for SwissBrain AI
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
#
# SECURITY WARNING:
# - Store this file securely
# - Do NOT commit to version control
# - Apply to Kubernetes: kubectl apply -f $OUTPUT_FILE
# - Delete after applying: rm $OUTPUT_FILE
#

---
apiVersion: v1
kind: Secret
metadata:
  name: generated-secrets
  namespace: swissbrain
  labels:
    app: swissbrain
    generated: "true"
type: Opaque
stringData:
  # JWT Secrets
  JWT_SECRET: "$JWT_SECRET"
  JWT_REFRESH_SECRET: "$JWT_REFRESH_SECRET"

  # Redis
  REDIS_PASSWORD: "$REDIS_PASSWORD"

  # Encryption
  ENCRYPTION_KEY: "$ENCRYPTION_KEY"
  ENCRYPTION_SALT: "$ENCRYPTION_SALT"

  # Session
  SESSION_SECRET: "$SESSION_SECRET"

---
# Template for remaining secrets (fill in manually)
apiVersion: v1
kind: Secret
metadata:
  name: api-keys
  namespace: swissbrain
type: Opaque
stringData:
  # External API Keys (FILL THESE IN MANUALLY)
  ANTHROPIC_API_KEY: "<YOUR_ANTHROPIC_API_KEY>"
  # OPENAI_API_KEY: "<YOUR_OPENAI_API_KEY>"

---
apiVersion: v1
kind: Secret
metadata:
  name: supabase-secrets
  namespace: swissbrain
type: Opaque
stringData:
  # Supabase Configuration (FILL THESE IN MANUALLY)
  SUPABASE_URL: "<YOUR_SUPABASE_URL>"
  SUPABASE_ANON_KEY: "<YOUR_SUPABASE_ANON_KEY>"
  SUPABASE_SERVICE_ROLE_KEY: "<YOUR_SUPABASE_SERVICE_ROLE_KEY>"

EOF

echo "✅ Secrets file generated: $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "  1. Edit $OUTPUT_FILE and fill in API keys and Supabase credentials"
echo "  2. Apply to Kubernetes: kubectl apply -f $OUTPUT_FILE"
echo "  3. Verify: kubectl get secrets -n swissbrain"
echo "  4. Delete the file: rm $OUTPUT_FILE"
echo ""
echo "⚠️  IMPORTANT: Keep this file secure and do not commit to git!"
