# SwissBrain/SwissVault Infrastructure Answers for Manus.im

## Prepared: January 9, 2026
## Based on: Complete project context review + today's build session

---

# Infrastructure Questions

## 1. Exoscale SKS Access

### kubectl configured locally?
**YES** - Configured and working today (Jan 9, 2026)

```bash
# Kubeconfig location
export KUBECONFIG=~/.kube/swissbrain-prod.yaml

# Verified working commands:
kubectl get nodes  # Returns 3 nodes
kubectl get pods -n swissbrain  # Shows running pods
kubectl rollout restart deployment/sandbox-executor -n swissbrain  # Tested today
```

### Can you SSH into worker nodes?
**UNCERTAIN** - Exoscale SKS is managed Kubernetes. Worker nodes are:

| Node | IP Address |
|------|------------|
| pool-9b710-scuez | 92.39.60.130 |
| pool-9b710-eolig | 92.39.62.222 |
| pool-9b710-jwbxa | 85.217.163.251 |

**For gVisor installation options:**
1. **DaemonSet approach** (preferred) - Install gVisor via DaemonSet without SSH
2. **Exoscale console access** - May be available via Exoscale portal
3. **Custom node pool** - Create new node pool with gVisor pre-installed

**SSH User:** Likely `ubuntu` (Exoscale default) but needs verification
**SSH Keys:** Unknown - need to check Exoscale console

**RECOMMENDATION:** Use DaemonSet-based gVisor installation to avoid SSH dependency

---

## 2. Container Registry

### Docker Hub access?
**YES** - Full push access confirmed today

```bash
# Registry details
Account: axessvideo
Repository: axessvideo/swissbrain-sandbox
Visibility: PUBLIC
Platform: linux/amd64

# Verified working today:
docker buildx build --platform linux/amd64 -t axessvideo/swissbrain-sandbox:latest --push .
```

### Private Exoscale Container Registry?
**NOT NEEDED** for now. Docker Hub public repo works fine.

**Future consideration:** Exoscale Container Registry for:
- Private enterprise images
- Faster Swiss-local pulls
- Air-gapped deployments

---

## 3. Domain & DNS

### Who manages DNS?
**IONOS** - Primary DNS provider

```
Domain: swissbrain.ai
DNS Provider: IONOS
A Record: api.swissbrain.ai → 185.19.28.196 (LoadBalancer IP)
```

### Additional subdomains preference?
**RECOMMENDATION:** Keep everything under `api.swissbrain.ai/...` for simplicity

```
Current:
- api.swissbrain.ai/          → Service info
- api.swissbrain.ai/health    → Health check
- api.swissbrain.ai/execute   → Code execution

Proposed paths (no new subdomains):
- api.swissbrain.ai/v1/sandbox/*     → Sandbox API
- api.swissbrain.ai/v1/stream/*      → SSE streaming
- api.swissbrain.ai/v1/warmpool/*    → Warm pool management
```

**Reason:** Single SSL cert, simpler ingress config, easier management

---

# Supabase Questions

## 4. Supabase Project

### Plan?
**PRO** - Based on features in use (multiple edge functions, storage buckets)

### Region?
**AWS us-east-1** (Lovable Cloud default - NOT Swiss)

```
Project ID: rljnrgscmosgkcjdvlrq
URL: https://rljnrgscmosgkcjdvlrq.supabase.co
```

**NOTE:** Supabase is NOT in Switzerland. Swiss data residency achieved via:
- Swiss K8s cluster for code execution
- Swiss Modal endpoints for inference
- Client-side encryption before Supabase storage

### Edge function deployment method?
**Supabase CLI** - Primary method

```bash
# Current deployment workflow:
cd ~/swissvault-supabase
supabase functions deploy <function-name> --no-verify-jwt

# Also via Lovable:
# Lovable auto-deploys edge functions when code changes
```

**NOT using:**
- GitHub Actions CI/CD (not configured)
- Manual upload

---

## 5. Environment Variables

### Status of referenced env vars:

| Variable | Status | Details |
|----------|--------|---------|
| `E2B_API_KEY` | ❌ NOT CONFIGURED | No E2B account - using Swiss K8s instead |
| `MODAL_API_KEY` | ✅ CONFIGURED | Workspace: malena |
| `MODAL_ENDPOINT` | ✅ CONFIGURED | https://malena--swissvault-inference-chat-completions.modal.run |
| `MODAL_DOCUMENT_GEN_ENDPOINT` | ⚠️ PARTIAL | May not be fully deployed |
| `UPSTASH_REDIS_REST_URL` | ✅ CONFIGURED | trusting-porpoise-29424.upstash.io |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ CONFIGURED | Working |
| `OPENAI_API_KEY` | ✅ CONFIGURED | |
| `ANTHROPIC_API_KEY` | ✅ CONFIGURED | |
| `GOOGLE_GEMINI_API_KEY` | ✅ CONFIGURED | |
| `DEEPSEEK_API_KEY` | ✅ CONFIGURED | |
| `XAI_API_KEY` | ✅ CONFIGURED | |
| `PERPLEXITY_API_KEY` | ✅ CONFIGURED | |
| `STRIPE_SECRET_KEY` | ✅ CONFIGURED | |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ CONFIGURED | Added Jan 3, 2026 |

---

# Code Execution Questions

## 6. Current Sandbox Behavior

### Current path when user runs code?

**Before today:** E2B → Modal → Simulation fallback
```
code-execute edge function checks:
1. E2B_API_KEY → If set, use E2B
2. MODAL_API_KEY → If set, use Modal
3. Else → Return simulation response
```

**After today's build:** Swiss K8s should be primary
```
NEW target path:
1. api.swissbrain.ai/execute → Swiss K8s cluster (Geneva)
2. Modal → Fallback for document generation
3. Simulation → Last resort fallback
```

**Current status:** 
- Swiss K8s API is LIVE and working
- Supabase edge function NOT YET connected to Swiss K8s
- Lovable prompt created but not executed

---

## 7. Language Support

### Currently supported:
- ✅ Python (primary)
- ✅ Shell/Bash
- ⚠️ JavaScript (via shell: `node script.js`)

### Additional languages needed?
**FOR MANUS PARITY:**
- ✅ TypeScript - YES (compile to JS)
- ⚠️ Go - NICE TO HAVE
- ⚠️ Rust - NICE TO HAVE

**RECOMMENDATION:** Focus on Python + TypeScript/Node.js first. These cover 95% of agent use cases.

---

# Security & Compliance Questions

## 8. Swiss Data Residency

### Must ALL data stay in Switzerland?

**TIERED APPROACH:**

| Data Type | Current Location | Required Location | Status |
|-----------|-----------------|-------------------|--------|
| Code execution | Swiss (Exoscale ch-gva-2) | Swiss | ✅ COMPLIANT |
| LLM API calls | US (OpenAI/Anthropic) | Flexible | ⚠️ ACCEPTABLE |
| Redis cache | Ireland (EU-West-2) | EU acceptable | ⚠️ ACCEPTABLE |
| File storage | US (Supabase) | Should be Swiss | ❌ NEEDS WORK |
| User data | US (Supabase) | Should be Swiss | ❌ NEEDS WORK |

**CRITICAL DATA (MUST BE SWISS):**
- Code execution containers → ✅ Swiss K8s
- Sensitive document processing → ✅ Swiss K8s
- Encryption keys → Client-side (browser)

**ACCEPTABLE IN EU:**
- Redis cache (ephemeral, no PII)
- LLM API calls (commercial APIs with DPAs)

**FUTURE MIGRATION:**
- Supabase → Self-hosted in Switzerland
- Redis → Swiss-hosted Redis (Exoscale)

---

## 9. Authentication

### Current auth method?
**Supabase Auth** - Primary and only method

Features in use:
- Email/password
- OAuth (Google, GitHub)
- Magic links
- JWT tokens for edge functions

### Enterprise SSO needed?
**YES - PLANNED FOR ENTERPRISE TIER**

Roadmap:
- SAML 2.0 (Okta, Azure AD, OneLogin)
- Generic OIDC provider support
- JIT provisioning
- SSO-only mode per organization

**NOT FOR INITIAL LAUNCH** - Focus on core platform first

---

# Operational Questions

## 10. Monitoring & Alerting

### Current monitoring?
**MINIMAL**

Currently:
- Supabase Dashboard (edge function logs)
- Manual `kubectl` commands
- No automated alerting

### Needed:
- Prometheus metrics endpoint (created today: `/metrics`)
- Grafana dashboards
- Alert destinations: **Slack** (preferred) or email

**RECOMMENDATION:** Set up basic Prometheus + Grafana in Swiss K8s cluster

---

## 11. CI/CD Pipeline

### Current state?
**NO CI/CD CONFIGURED**

Current manual workflows:
```bash
# Supabase functions
supabase functions deploy <name>

# Kubernetes
docker buildx build ... --push
kubectl rollout restart deployment/...

# Frontend
Lovable handles automatically
```

### Needed:
- GitHub Actions for Supabase function deployments
- GitHub Actions for Kubernetes deployments (via kubectl)
- Frontend handled by Lovable (automatic)

---

## 12. Team Access

### How many people deploying/managing?
**1 PERSON** - Malena Cutuli (Founder)

### RBAC needed?
**NOT INITIALLY** - Single operator

Future needs:
- Kubernetes RBAC when team grows
- Supabase project roles (admin, developer, viewer)
- Separate production/staging environments

---

# Budget & Scale Questions

## 13. Expected Load

### Concurrent users at launch?
**TARGET: 10,000 concurrent users**

### Agent tasks per day?
**ESTIMATE: 50,000-100,000 tasks/day** at scale

### Warm pool sizing recommendation:

| Scale | Warm Pool Size | Nodes | Monthly Cost |
|-------|---------------|-------|--------------|
| Beta (100 users) | 10 containers | 3 nodes | $300 |
| Launch (1,000 users) | 50 containers | 5 nodes | $600 |
| Growth (10,000 users) | 200 containers | 10 nodes | $1,500 |

### API cost limits?
**NO HARD LIMITS** - But optimize for efficiency

Cost management strategy:
1. **Primary model:** gemini-2.5-flash (50 RPM, low cost)
2. **Fallback chain:** claude-haiku → deepseek → gpt-4o-mini
3. **Redis caching:** 60-70% cache hit rate target
4. **Token budgets:** Per-user limits by tier

Estimated AI API costs at scale:
- 10,000 users, 50K tasks/day: ~$5,000-10,000/month

---

# Summary: Key Infrastructure Facts

| Component | Value |
|-----------|-------|
| **K8s Cluster** | Exoscale SKS, ch-gva-2, 3 nodes |
| **K8s API** | api.swissbrain.ai (HTTP, SSL pending) |
| **LoadBalancer IP** | 185.19.28.196 |
| **Docker Registry** | axessvideo/swissbrain-sandbox (Docker Hub) |
| **DNS Provider** | IONOS |
| **Supabase Project** | rljnrgscmosgkcjdvlrq (Pro plan, US region) |
| **Redis** | Upstash (EU-West-2) |
| **Modal Org** | axessible-labs |
| **Default AI Model** | gemini-2.5-flash (50 RPM) |
| **Target Scale** | 10,000 concurrent users |
| **Team Size** | 1 (solo founder) |

---

# Immediate Blockers for Manus Parity

1. **gVisor installation** - Need DaemonSet approach or SSH access
2. **SSL/HTTPS** - Cluster DNS blocking cert-manager (use Cloudflare)
3. **Supabase-K8s connection** - Edge function update needed
4. **Warm pool** - Not implemented yet
5. **SSE streaming** - Not implemented yet

---

*Document prepared from project knowledge files and today's build session*
*January 9, 2026*
