# SWISSVAULT COMPLETE CONTEXT - JANUARY 19, 2026

**Generated**: January 19, 2026
**Repository**: https://github.com/malenacutuli/swiss-ai-vault
**Analysis by**: Claude Opus 4.5

---

## SECTION 1: EXECUTIVE SUMMARY

### Repository Overview
| Metric | Value |
|--------|-------|
| Total Commits | 2,522 |
| Repository Size | 120MB |
| TypeScript Files | 836 |
| Python Files | 22 |
| Edge Functions | 83 |
| Database Migrations | 151 |
| React Components | 46 |
| Custom Hooks | 81 |
| Pages/Routes | 61 |

### Last Commits
```
b59fffd Lovable update
ab472b5 Changes
d6a290a fix: sync package-lock.json with package.json
0b139f5 fix(ci): use npm install instead of npm ci for optional deps compatibility
261c979 fix: regenerate package-lock.json to resolve tree-sitter conflict
724c5a1 fix: sync package-lock.json with package.json
822b9f4 Merge pull request #1 from malenacutuli/phase-8-advanced-features
8664e99 feat(sandbox): add resource limits, dependency merger, deployment automation
0c7f6fd Replace Swiss with Manus styles
98f18fa Changes
```

### Overall Health: **HEALTHY** (with routing issues in K8s)
- Build: **PASSING**
- Lint: **WARNINGS** (style issues, not blocking)
- Swiss K8s Cluster: **RUNNING** (3 nodes, v1.35.0)
- Agent API: **RUNNING** (v16-auth-fix deployed, routing needs fix)

---

## SECTION 2: CODEBASE INVENTORY

| Component | Count | Location |
|-----------|-------|----------|
| TypeScript files | 836 | src/, supabase/functions/ |
| Python files | 22 | agent-api/, modal/, sandbox-executor/ |
| Edge functions | 83 | supabase/functions/ |
| Database migrations | 151 | supabase/migrations/ |
| React components | 46 | src/components/ |
| Custom hooks | 81 | src/hooks/ |
| Pages/Routes | 61 | src/pages/ |
| K8s manifests | 14 dirs | k8s/ |

### Frontend (src/)
- **Components**: 46 reusable components
- **Hooks**: 81 custom hooks for data/state management
- **Pages**: 61 page components (routes)
- **Contexts**: 5 contexts + 5 additional contexts
- **Lib**: 37 utility libraries
- **Types**: 9 type definition files

### Backend Architecture
- **agent-api/app/** - Python FastAPI backend
  - `analysis/` - Data analysis tools
  - `browser/` - Browser automation sessions
  - `mcp/` - Model Context Protocol handling
  - `research/` - Wide research coordination
  - `sandbox/` - Code execution sandboxes
  - `scheduler/` - Task scheduling

---

## SECTION 3: INFRASTRUCTURE CODE

### Kubernetes (k8s/)
| Directory | Purpose |
|-----------|---------|
| autoscaling/ | HPA configurations |
| cert-manager/ | SSL/TLS certificate automation |
| config/ | ConfigMaps and settings |
| deployments/ | Pod deployment manifests |
| ingress/ | Ingress rules |
| monitoring/ | Prometheus/Grafana |
| namespaces/ | Namespace definitions |
| phase9/ | Phase 9 advanced features |
| policies/ | Network policies |
| redis/ | Redis/Upstash config |
| secrets/ | Secret templates |

### Modal Apps (modal/)
| App | File |
|-----|------|
| swissvault-browser-automation | browser_automation.py (27KB) |

### Agent API (agent-api/)
| Directory | Contents |
|-----------|----------|
| app/ | FastAPI application code |
| tests/ | Test suite |
| supabase_migrations/ | API-specific migrations |

### Sandbox Executor (sandbox-executor/)
- Isolated code execution environment
- Swiss K8s deployment

---

## SECTION 4: DATABASE SCHEMA

### Migration Stats
- **Total Migrations**: 151
- **Latest Migration**: 20260119095637 (today)

### Recent Migrations (last 20)
```
20260112000008_token_tracking.sql
20260112000009_response_cache.sql
20260112000010_prompt_templates.sql
20260112000011_tenant_isolation.sql
20260112000012_audit_logging.sql
20260112000013_usage_analytics.sql
20260112000014_profile_preferences.sql
20260112000015_scheduled_tasks.sql
20260112000016_vector_search.sql
20260112000017_enhanced_scheduled_tasks.sql
20260112000018_stripe_billing.sql
20260113100001_create_profiles_table.sql
20260113100002_create_artifacts_table.sql
20260113100003_create_documents_table.sql
20260113100004_create_connector_credentials_table.sql
20260116114304_*.sql
20260116163843_*.sql
20260116164637_*.sql
20260116203648_*.sql
20260119095637_*.sql (today)
```

### Key Tables Added Recently
1. **profiles** - User settings and preferences
2. **artifacts** - Generated agent artifacts
3. **documents** - Document storage with sync
4. **connector_credentials** - OAuth token storage

### Healthcare-Related Tables
- **None currently** - Healthcare tables need to be created

---

## SECTION 5: KEY DEPENDENCIES

### Frontend (88 dependencies)
| Dependency | Version | Purpose |
|------------|---------|---------|
| @monaco-editor/react | ^4.7.0 | Code editor |
| @radix-ui/* | Various | UI primitives |
| @hookform/resolvers | ^3.10.0 | Form validation |
| @huggingface/transformers | ^3.8.1 | Local ML (Ghost mode) |
| @supabase/supabase-js | Latest | Database client |
| react | 18.x | UI framework |
| tailwindcss | Latest | Styling |
| vite | Latest | Build tool |

### Backend (Python)
- FastAPI + uvicorn
- Supabase Python client
- Anthropic SDK
- OpenAI SDK
- redis-py (async)
- httpx
- e2b-code-interpreter

---

## SECTION 6: EDGE FUNCTIONS (83 Total)

### Agent Functions
- agent-execute
- agent-logs
- agent-plan
- agent-status
- agent-templates-list
- agent-wide-research

### AI/Generation Functions
- chat / chat-completions
- deep-research / encrypted-deep-research
- generate-document / generate-image / generate-pptx / generate-slides
- gemini-tts / gemini-video
- video-generator
- voice
- audio-briefing / notebooklm-audio

### Ghost Mode Functions
- ghost-api
- ghost-compare
- ghost-deep-research
- ghost-discover
- ghost-finance-data
- ghost-image-gen
- ghost-inference
- ghost-video-gen
- ghost-voice
- ghost-web-search

### OAuth/Integrations
- github-oauth / github-sync
- gmail-oauth / gmail-sync
- googledrive-oauth / googledrive-import
- notion-oauth / notion-sync
- slack-oauth / slack-sync

### Utility Functions
- swiss-health (system health monitoring)
- analytics
- audit-logs
- cache-stats
- stripe / stripe-webhook
- usage-stats
- embeddings / embed-document / search-documents

---

## SECTION 7: AGENT SYSTEM ARCHITECTURE

### Current Task Routing
| Task Type | Backend | Status |
|-----------|---------|--------|
| Code execution | Swiss K8s (E2B sandbox) | ✅ Working |
| Shell commands | Swiss K8s (E2B sandbox) | ✅ Working |
| Documents/Slides | Modal (swissvault-document-gen) | ✅ Working |
| Research | Perplexity + Gemini | ✅ Working |
| Browser automation | Modal (browser_automation.py) | ✅ Working |
| Wide research | agent-api coordinator | ✅ Working |
| Healthcare | **NOT IMPLEMENTED** | ❌ Needed |

### Agent API Capabilities
- **Analysis**: Data analysis tools (data_analyzer.py)
- **Browser**: Session management (session_manager.py)
- **MCP**: Model Context Protocol (protocol_handler.py)
- **Research**: Parallel coordination, job management, synthesis
- **Sandbox**: Resource limits, dependency merging, deployment, dev server
- **Scheduler**: Task scheduling

### Connectors Available
- GitHub (OAuth + sync)
- Slack (OAuth + sync)
- Google Drive (OAuth + import)
- Gmail (OAuth + sync)
- Notion (OAuth + sync)

---

## SECTION 8: HEALTHCARE READINESS

### Current Healthcare Code
| Component | Status |
|-----------|--------|
| Healthcare tables | ❌ Not created |
| HIPAA compliance | ❌ Not implemented |
| Healthcare agents | ❌ Not implemented |
| Clinical workflows | ❌ Not implemented |
| Medical templates | ❌ Not implemented |
| swiss-health function | ✅ Exists (system health, not medical) |

### Files Mentioning Health (Non-medical)
- `swiss-health` edge function (system health monitoring)
- Various `.md` docs mentioning "health checks" (infrastructure)

### What Exists for Healthcare
- **Privacy Architecture**: Ghost mode with local processing
- **Encryption**: Zero-knowledge option available
- **Audit Logging**: Infrastructure exists
- **Swiss Data Residency**: Compliant infrastructure

### What Needs to Be Built
1. Healthcare database schema (patients, records, appointments, etc.)
2. HIPAA-compliant audit logging
3. Healthcare agent tools (medical research, clinical workflows)
4. Healthcare UI components
5. Medical document generation templates
6. Integration with healthcare APIs (HL7/FHIR)

---

## SECTION 9: CURRENT DEPLOYMENT STATUS

### Swiss K8s Cluster (Exoscale SKS Geneva)
- **Nodes**: 3 nodes running K8s v1.35.0
- **Namespaces**: agents, cert-manager, ingress-nginx, swissbrain

### Agent API (agents namespace)
- **Image**: axessvideo/agent-api:v16-auth-fix
- **Status**: Pod running (1/1 Ready)
- **Issue**: Ingress routing conflict with swissbrain namespace

### Agent Worker (agents namespace)
- **Image**: axessvideo/agent-api:v15-swissbrain
- **Status**: Running (2 replicas)

### Known Issues
1. **Ingress Conflict**: Two ingresses for api.swissbrain.ai
   - agent-api-ingress (agents namespace)
   - swissbrain-ingress (swissbrain namespace)
   - Currently swissbrain-ingress serves sandbox-executor on "/"

2. **Cross-namespace routing**: ExternalName service created but returning 504

---

## SECTION 10: RECOMMENDED NEXT STEPS

### Immediate (Fix Current Issues)
1. **Fix API Ingress Routing**
   - Option A: Delete swissbrain "/" route, keep only /v1/sandbox
   - Option B: Create single consolidated ingress
   - Option C: Use separate subdomain for agent-api

2. **Update Worker Image**
   - Update worker to v16-auth-fix for consistency

### Healthcare Agents Implementation
1. **Database Schema**
   - Create healthcare-specific tables with encryption
   - Add HIPAA audit logging columns
   - Implement tenant isolation for healthcare data

2. **Agent Tools**
   - Create healthcare research tool
   - Create clinical workflow tool
   - Create medical document generator
   - Create appointment scheduler

3. **Edge Functions**
   - `healthcare-research` - Medical literature search
   - `healthcare-workflow` - Clinical workflow automation
   - `healthcare-records` - Patient record management
   - `healthcare-scheduling` - Appointment management

4. **UI Components**
   - Healthcare dashboard
   - Patient management views
   - Clinical workflow builder
   - Medical report generator

5. **Compliance**
   - HIPAA audit trail implementation
   - Consent management system
   - Data retention policies
   - Access control enhancements

---

## SECTION 11: TECHNICAL ARCHITECTURE REFERENCE

### Privacy Tiers
```
TIER 1: GHOST MODE (Maximum Privacy)
├── Documents: IndexedDB only (never leave browser)
├── Embeddings: Transformers.js (local, 384-dim)
├── RAG: client-vector-search (local)
├── AI: Only top-K chunks sent
└── Features: Basic chat, local search, memory

TIER 2: VAULT MODE (Swiss-Protected)
├── Documents: Swiss S3 (Zurich)
├── Embeddings: text-embedding-004 (768-dim)
├── RAG: Supabase vectors
├── AI: Full context available
└── Features: All features + sync

TIER 3: ENTERPRISE MODE (Dedicated)
├── Dedicated infrastructure
├── Custom compliance
└── Full audit trails
```

### AI Provider Integrations
| Provider | Models | Status |
|----------|--------|--------|
| OpenAI | GPT-4o, o1, o3, DALL-E 3, Whisper, TTS | ✅ |
| Anthropic | Claude Sonnet 4, Haiku | ✅ |
| Google | Gemini 2.5 Flash/Pro, Gemini 3, Imagen 3 | ✅ |
| DeepSeek | DeepSeek V3, R1 | ✅ |
| xAI | Grok 2, Grok 3 | ✅ |
| Perplexity | Sonar, Sonar-pro | ✅ |
| Modal | Llama, Mistral, Qwen (self-hosted) | ✅ |

---

## SECTION 12: API ENDPOINTS

### Agent API (api.swissbrain.ai)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| /health | GET | Health check |
| /agent/execute | POST | Execute agent task |
| /agent/{task_id}/status | GET | Task status |
| /agent/{task_id}/logs | GET | Task logs |
| /api/connectors | GET | List connections |
| /api/connectors/available | GET | Available connectors |
| /api/connectors/oauth/{provider}/initiate | POST | Start OAuth |
| /api/connectors/oauth/{provider}/callback | GET | OAuth callback |
| /docs | GET | OpenAPI docs |

---

*Document generated by Claude Opus 4.5 on January 19, 2026*
*For Healthcare Agents implementation, proceed with Section 10 recommendations*
