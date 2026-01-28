# SwissVault.ai / SwissBrain.ai - Platform Technical Analysis

**Date:** January 27, 2026
**Prepared for:** Technical Team & Investor Due Diligence
**Auditor:** Claude Code (Automated Deep Audit)

---

## EXECUTIVE SUMMARY

SwissVault.ai (branded SwissBrain.ai) is a multi-tenant enterprise AI platform combining encrypted chat, agentic task execution, model fine-tuning, voice AI, and multi-provider model routing. The platform spans ~209,000 lines of frontend TypeScript, 628 Python backend files, 119 Supabase Edge Functions, 108+ database migrations, and a Kubernetes + Modal.com GPU infrastructure.

**Key Strengths:** End-to-end encryption (AES-256-GCM), multi-model routing (6+ AI providers), comprehensive billing engine, Swiss data sovereignty design, healthcare-specific compliance module.

**Key Risks:** No frontend test suite, Stripe webhook deduplication gap, GPU infrastructure driver incompatibility on Exoscale (Blackwell), some code duplication across agent execution variants.

---

## 1. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18.3 / Vite)             │
│  81 routes · 448 components · 10 languages · AES-256-GCM E2EE  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS / WSS
┌────────────────────────▼────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS (Deno)               │
│  119 functions · Multi-model routing · Billing · OAuth · Voice  │
└──────┬──────────┬──────────┬──────────┬──────────┬─────────────┘
       │          │          │          │          │
┌──────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐ ┌───▼──────────┐
│ Supabase │ │ Agent  │ │External│ │ Modal  │ │  Exoscale    │
│PostgreSQL│ │  API   │ │  APIs  │ │  GPU   │ │  SKS (K8s)   │
│ pgvector │ │(FastAPI)│ │(6+ AI)│ │PersonaP│ │  Swiss Infra  │
└──────────┘ └────────┘ └────────┘ └────────┘ └──────────────┘
```

### Architecture Pattern
- **Frontend:** React SPA with client-side encryption
- **Backend:** Serverless edge functions (Deno) + FastAPI microservice
- **Database:** PostgreSQL (Supabase) with pgvector, RLS, real-time subscriptions
- **Compute:** Modal.com serverless GPU (voice AI), Exoscale SKS Kubernetes (sandbox execution)
- **CDN/Hosting:** Vercel (frontend), Supabase (edge functions + database)

---

## 2. TECHNOLOGY STACK

### Frontend
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | 18.3.1 |
| Build | Vite | 5.4.19 |
| Language | TypeScript | 5.8.3 |
| Routing | React Router | 6.30.1 |
| State | React Context + TanStack Query | 5.83.0 |
| UI Library | Shadcn/ui + Radix UI | 12+ primitives |
| CSS | Tailwind CSS | 3.4.17 |
| Forms | React Hook Form + Zod | 7.61.1 / 3.25.76 |
| Encryption | Web Crypto API | Native (AES-256-GCM) |
| i18n | i18next | 25.7.1 (10 languages) |
| Charts | Recharts + D3.js | 2.15.4 / 7.9.0 |
| Terminal | XTerm.js | 5/6 |
| Code Editor | Monaco Editor | 0.55.1 |
| 3D | Three.js + React Three Fiber | 0.170.0 |
| Animation | Framer Motion | 12.24.0 |
| Voice | Hume AI SDK + WaveSurfer | Latest |

### Backend
| Component | Technology | Details |
|-----------|-----------|---------|
| Edge Functions | Deno (Supabase) | 119 functions |
| Agent API | Python FastAPI | 628 files, 26 modules |
| Database | PostgreSQL 15+ | pgvector, pgsodium |
| Cache | Redis + Upstash | BullMQ job queue |
| Auth | Supabase Auth | JWT + OAuth2 |
| Payments | Stripe | Subscriptions + credits |
| File Storage | Supabase Storage | 6 buckets |

### Infrastructure
| Component | Technology | Details |
|-----------|-----------|---------|
| Frontend Hosting | Vercel | Auto-deploy from GitHub |
| Database | Supabase Cloud | Project: rljnrgscmosgkcjdvlrq |
| GPU Compute | Modal.com | A10G, PersonaPlex voice |
| Kubernetes | Exoscale SKS | ch-gva-2 (Geneva), ch-dk-2 (Denmark) |
| CI/CD | GitHub Actions | 7 workflows |
| Containers | Docker | 7 Dockerfiles |
| DNS/TLS | Cloudflare + cert-manager | Let's Encrypt |
| Monitoring | Prometheus + Grafana | K8s metrics |

---

## 3. FEATURES INVENTORY

### 3.1 Core Chat Products

#### VaultChat (Encrypted, Pro tier)
- **Status:** WORKING
- End-to-end AES-256-GCM encryption
- Client-side key derivation (PBKDF2, 100k iterations, 64KB memory)
- Zero-trace retention mode (auto-delete after conversation)
- Configurable retention: zerotrace / 1 day / 1 week / 90 days / forever
- Encrypted document upload with chunked vector embeddings
- Message sequence numbering for ordering integrity
- Per-conversation encryption keys with key rotation support
- Recovery key mechanism
- Shared conversations with permission levels (view/comment/edit)

#### Ghost Mode (Free tier)
- **Status:** WORKING
- Free anonymous usage with IP-based rate limiting (SHA-256 hashed)
- Daily limits: 10 prompts, 2 images, 2 videos, 2 research queries (free)
- Ghost Pro: Unlimited text, 1000 images/day
- Credit purchase system (Stripe one-time payments)
- Content library (images, videos, audio) with favorites and folders
- Domain-specific interfaces: Finance, Patents, Legal, Research, Security, Health, Travel, Real Estate, Art, VC
- Model comparison tool (side-by-side responses from multiple models)
- API key management with per-key rate limits and permissions

### 3.2 AI Model Routing

**Multi-Provider Chat Router** (`chat-completions`, `ghost-inference`)
- **Status:** WORKING
- **Providers integrated:**

| Provider | Models | Status |
|----------|--------|--------|
| Anthropic | Claude Sonnet 4.5, Claude 3.5 Sonnet, Claude 3.5 Haiku | Active |
| OpenAI | GPT-4o, GPT-4o-mini, GPT-4.1, GPT-5, o3-mini | Active |
| Google | Gemini 2.5 Flash, Gemini 2.5 Pro | Active |
| xAI | Grok models | Active |
| DeepSeek | DeepSeek models | Active |
| Modal (vLLM) | Self-hosted open models | Active (with cold-start fallback) |

- Model aliasing (auto-upgrades deprecated model IDs)
- Fallback chains: vLLM → GPT-4o-mini if user allows
- 90-second timeout for vLLM cold starts
- Streaming support (SSE)
- Semantic caching (pgvector, 768-dim embeddings)

### 3.3 Voice AI

#### PersonaPlex (English, GPU)
- **Status:** DEPLOYED ON MODAL (Exoscale blocked - see Bugs)
- NVIDIA PersonaPlex/Moshi speech-to-speech
- 5 personas: Health Advisor, Financial Analyst, Legal Assistant, Research Assistant, Executive Assistant
- WebSocket real-time audio streaming
- Modal A10G GPU with single ASGI endpoint

#### Hume EVI (Multilingual)
- **Status:** WORKING
- Empathic Voice Interface for non-English languages
- Supported: en, de, fr, it, es, pt, zh, ja, ko
- OAuth2 client-credentials token flow
- Voice names: ITO, DACHER, KORA per persona

#### Voice Routing (`voice-persona`)
- **Status:** WORKING
- English → PersonaPlex (Modal GPU)
- Other languages → Hume EVI
- Automatic fallback: PersonaPlex failure → Hume EVI
- Session usage tracking (duration, audio seconds, backend used)
- Subscription gating: Pro+ required

### 3.4 Agent Execution (Manus-style)

- **Status:** WORKING (multiple implementations)
- Task orchestration with step-by-step execution
- Plan generation via Gemini AI
- Tool calling: browser automation, code execution, web search, document generation
- Real-time streaming via SSE
- Execution checkpoints and replay
- Wide research: parallel multi-source queries (Perplexity + Gemini + Web)
- Scheduled tasks with cron expressions
- Output types: PPTX, DOCX, XLSX, PDF, images, code, HTML, CSV, JSON

**Execution Backends:**
1. Supabase Edge Functions (primary)
2. External Agent API (swissbrain.ai FastAPI)
3. E2B Sandbox (code execution)
4. Modal (browser automation)

### 3.5 Research & Analysis

#### Deep Research
- **Status:** WORKING
- Multi-source: Perplexity AI (primary) + Serper (fallback) + Gemini (synthesis)
- Citation extraction and verification
- Claims analysis
- Follow-up question generation
- Tier-based quotas: Free (3/month), Pro (50), Team (200), Enterprise (unlimited)

#### Audio Briefings (NotebookLM-style)
- **Status:** WORKING
- Podcast-style dialogue generation between two hosts
- Formats: Deep Dive, Quick Brief, Debate, Critique, Tutorial
- Durations: Short (4-5 min), Medium (8-10 min), Long (15-20 min)
- 12 languages supported
- Google Gemini for script generation, OpenAI TTS for voice synthesis
- Stored in Supabase Storage with 24h expiry

### 3.6 Content Generation

| Feature | Provider | Output | Status |
|---------|----------|--------|--------|
| Image Generation | Gemini + OpenAI DALL-E | PNG/JPEG | Working |
| Video Generation | Gemini | MP4 | Working |
| Document Generation | Gemini | DOCX/PDF | Working |
| Slide Generation | Gemini | PPTX | Working |
| TTS | Gemini + OpenAI | MP3/WAV | Working |
| Synthetic Data | Anthropic | JSONL | Working |

### 3.7 Fine-Tuning Platform (VaultLabs)

- **Status:** BUILT (UI + DB schema complete)
- Project management with status tracking
- Dataset management: Upload, synthetic generation, enrichment, merging
- Dataset snapshots with train/val splits
- Fine-tuning jobs: Full, LoRA, QLoRA methods
- Hyperparameter configuration
- Model registry with deployment tracking
- Evaluation framework: LLM Judge, String Match, LCS scoring
- 15+ multilingual templates (DE, FR, IT, ES, PT, NL, Swiss German)
- Experiment tracking with training loss curves

### 3.8 Integrations

| Integration | OAuth | Sync | Actions | Status |
|-------------|-------|------|---------|--------|
| GitHub | Yes | Yes | Yes | Working |
| Gmail | Yes | Yes | Yes | Working |
| Google Drive | Yes | Import | - | Working |
| Notion | Yes | Yes | Yes | Working |
| Slack | Yes | Yes | Yes | Working |
| Stripe | Webhook | - | Billing | Working |

#### VaultMail
- **Status:** BUILT (DB schema + edge functions)
- Gmail/Outlook OAuth integration
- AI-powered email categorization (to-respond, FYI, marketing, meeting, automated, urgent)
- Draft generation with tone control (professional, friendly, formal, casual, brief)
- User writing style profiles (greeting patterns, closing patterns, phrase analysis)
- Thread management with labels

### 3.9 Code Execution Sandbox

- **Status:** WORKING (with fallback chain)
- Languages: Python, JavaScript, Shell
- Security scanning (blocks fork bombs, rm -rf, eval, etc.)
- Tier-based resource limits
- Execution chain: Swiss K8s → E2B → Modal → Simulation fallback
- Execution logging and credit tracking

### 3.10 Healthcare Module (VaultHealth)

- **Status:** BUILT (DB schema + 8 edge functions)
- Patient management
- Appointment scheduling
- Prescription handling
- Medical records
- Healthcare research queries
- Audit logging (compliance)
- Workflow automation
- HIPAA-aware design (encrypted storage, audit trails)

### 3.11 Admin & Analytics

- **Status:** WORKING
- Admin dashboard with user management
- Audit log search and CSV export (immutable logs)
- Usage analytics per user and organization
- Engagement metrics tracking
- Role-based access control (admin, owner, member, viewer)

### 3.12 Billing Engine

- **Status:** WORKING
- Stripe subscriptions (Pro monthly/yearly, Enterprise monthly/yearly)
- One-time credit purchases ($5, $20, $50, $100)
- Ghost credits (free daily + purchased)
- Unified subscription tiers: ghost_free, ghost_pro, premium, enterprise
- Usage tracking: text prompts, images, videos, deep research
- Credit reservation, charging, and refund mechanics
- Rate limiting per tier
- Auto-provisioning on signup (free tier with $5 starter credits)

---

## 4. API INTEGRATIONS MAP

### External AI Providers
| Service | API Keys Required | Used For |
|---------|------------------|----------|
| Anthropic | `ANTHROPIC_API_KEY` | Claude models, synthetic data |
| OpenAI | `OPENAI_API_KEY` | GPT models, TTS, embeddings, image gen |
| Google Gemini | `GOOGLE_GEMINI_API_KEY` | Gemini models, TTS, video, documents |
| Perplexity | `PERPLEXITY_API_KEY` | Deep research, web search |
| xAI | `XAI_API_KEY` | Grok models |
| DeepSeek | `DEEPSEEK_API_KEY` | DeepSeek models |
| Hume AI | `HUME_API_KEY` + `HUME_SECRET_KEY` | Voice EVI (multilingual) |
| Serper | `SERPER_API_KEY` | Fallback web search |

### Infrastructure Services
| Service | API Keys Required | Used For |
|---------|------------------|----------|
| Supabase | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Database, auth, storage, edge functions |
| Stripe | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Payments, subscriptions |
| Modal | `MODAL_API_KEY` + `MODAL_SECRET` | GPU compute, browser automation |
| E2B | (implicit) | Code sandbox execution |
| Upstash Redis | `UPSTASH_REDIS_REST_URL` + `TOKEN` | Caching, rate limiting |
| HuggingFace | `HUGGINGFACE_TOKEN` | Model downloads |

### Third-Party Integrations
| Service | API Keys Required | Used For |
|---------|------------------|----------|
| GitHub | `GITHUB_CLIENT_ID/SECRET_INTEGRATION` | OAuth, repo sync |
| Google | `GOOGLE_CLIENT_ID/SECRET` | OAuth, Drive import |
| Notion | (OAuth) | Page sync |
| Slack | (OAuth) | Channel sync, actions |
| Lovable | `LOVABLE_API_KEY` | AI Gateway routing |
| Manus | `MANUS_API_KEY` | Agent execution |

**Total unique API integrations: 18+**

---

## 5. DATABASE SCHEMA

### Table Count: 60+ tables across domains

#### Core Entities
- `users`, `organizations`, `organization_members`, `organization_invitations`
- `user_settings`, `user_roles`, `api_keys`

#### Chat & Encryption (3 separate chat systems)
- **VaultChat (E2EE):** `encrypted_conversations`, `encrypted_messages`, `conversation_keys`, `encrypted_documents`, `encrypted_document_chunks`, `user_encryption_settings`
- **Standard Chat:** `chat_conversations`, `chat_messages`, `chat_attachments`, `chat_shared_conversations`, `chat_integrations`, `chat_integration_data`
- **Vault Chat (simplified):** `vault_chat_conversations`, `vault_chat_messages`, `vault_chat_shared_conversations`

#### Ghost Mode
- `ghost_settings`, `ghost_credits`, `ghost_subscriptions`, `ghost_usage`
- `ghost_library`, `ghost_folders`, `ghost_api_keys`
- `ghost_comparisons`, `ghost_comparison_responses`
- `anonymous_usage`

#### Agent System
- `agent_tasks`, `agent_task_steps`, `agent_outputs`
- `agent_sessions`, `agent_tool_calls`
- `scheduled_tasks`, `wide_research_jobs`
- `action_templates`

#### Fine-Tuning
- `projects`, `datasets`, `dataset_snapshots`
- `finetuning_jobs`, `finetuning_templates`, `experiments`
- `base_models`, `models`, `deployments`
- `evaluations`, `metrics`, `traces`

#### Billing
- `billing_customers`, `billing_invoices`
- `user_credits`, `credit_transactions`
- `unified_subscriptions`, `unified_credits`, `unified_daily_usage`
- `tier_limits`, `usage_daily`, `usage_finetuning`

#### Research & Knowledge
- `research_queries`, `research_quotas`
- `knowledge_projects`, `knowledge_project_files`, `knowledge_project_conversations`, `knowledge_project_memory`
- `document_chunks` (pgvector 1536-dim)

#### Mail
- `vault_mail_accounts`, `vault_mail_threads`, `vault_mail_messages`
- `vault_mail_drafts`, `vault_mail_style_profiles`

#### Infrastructure
- `semantic_cache` (pgvector 768-dim), `inference_stats`
- `audit_logs`, `notifications`

### Storage Buckets (6)
| Bucket | Max Size | Purpose |
|--------|----------|---------|
| datasets | 100 MB | Training data |
| models | 5 GB | Fine-tuned models |
| exports | 10 GB | Generated exports |
| documents | 500 MB | Uploaded documents |
| avatars | - | User avatars (public) |
| audio-briefings | 50 MB | Generated audio |

---

## 6. SECURITY & PRIVACY ANALYSIS

### 6.1 Encryption

| Layer | Method | Details |
|-------|--------|---------|
| Transport | TLS 1.3 | All endpoints HTTPS/WSS |
| Chat E2EE | AES-256-GCM | Client-side, 256-bit keys, 12-byte IV, 128-bit auth tag |
| Key Derivation | PBKDF2 | 100,000 iterations, 65,536 bytes memory |
| Key Storage | IndexedDB | Browser-side, never sent to server |
| Key Wrapping | Per-conversation | Wrapped keys stored, master key client-only |
| OAuth Tokens | AES-256-GCM | Encrypted before database storage |
| Document Chunks | Per-chunk encryption | Encrypted embeddings for E2EE RAG |

### 6.2 Authentication
- Supabase Auth (JWT-based)
- Cross-project token authentication for agent services
- OAuth 2.0 for third-party integrations (GitHub, Google, Notion, Slack)
- API key authentication with hashed storage (key_hash + key_prefix)
- SSO callback support

### 6.3 Authorization
- PostgreSQL Row-Level Security (RLS) on all tables
- Security definer functions: `has_role()`, `is_org_admin()`, `is_org_member()`
- REVOKE anonymous access on sensitive tables
- FORCE ROW LEVEL SECURITY on all user-facing tables
- Organization-based multi-tenancy with role hierarchy

### 6.4 Audit & Compliance
- Immutable audit log table (SQL RULES prevent UPDATE/DELETE)
- Audit triggers on: datasets, models, finetuning jobs, mail accounts
- Captures: user, action, resource, old/new values, IP, user-agent
- CSV export for compliance reporting
- Healthcare audit logging (HIPAA-aware)

### 6.5 Data Retention
- Configurable per-conversation retention (zerotrace → forever)
- Automatic expired message cleanup via cron function
- User-configurable data/log retention days
- Anonymous usage data with IP hashing (no raw IPs stored)

### 6.6 Security Concerns

| Issue | Severity | Details |
|-------|----------|---------|
| No frontend tests | HIGH | No unit/E2E testing - regressions undetected |
| Stripe webhook deduplication | MEDIUM | No idempotency check - duplicate events could double-process |
| IP-based rate limiting | LOW | Easily bypassed with proxies for anonymous tier |
| Hardcoded pricing | LOW | Credit amounts hardcoded, not configurable |
| Agent function duplication | LOW | 3 variants of agent-execute with inconsistent features |
| SSE memory leak risk | LOW | setInterval in ReadableStream without cleanup guarantee |
| Model alias silent upgrade | LOW | Users may not know they're using a different model |

---

## 7. INFRASTRUCTURE ANALYSIS

### 7.1 Kubernetes (Exoscale SKS)

**Clusters:**
| Cluster | Zone | Purpose | Status |
|---------|------|---------|--------|
| swissbrain-prod | ch-gva-2 (Geneva) | Production workloads | Running (3 worker nodes) |
| SwissBrainGPU | ch-dk-2 (Denmark) | GPU workloads | Running (no GPU node pool) |
| SwissBrainGPU2 | at-vie-1 (Vienna) | GPU workloads | Running |

**K8s Resources Configured:**
- Namespace: `swissbrain`
- Deployments: sandbox-executor, agent API
- HPA/VPA: Auto-scaling for sandbox executor
- Network Policies: Sandbox isolation
- Pod Disruption Budgets: High availability
- Redis StatefulSet: Caching + BullMQ
- Ingress: NGINX with TLS (Let's Encrypt)
- Monitoring: Prometheus + Grafana
- RBAC: Role-based cluster access

### 7.2 Modal.com (Serverless GPU)

**Active Apps:**
| App | Purpose | GPU | Endpoints |
|-----|---------|-----|-----------|
| personaplex | Voice AI (Moshi) | A10G | 1 (ASGI: /health, /personas, /ws) |
| swissvault-main | Primary inference | - | Multiple |
| swissvault-document-gen | Document generation | - | Multiple |
| swissvault-agents | Agent execution | - | Multiple |

### 7.3 CI/CD Pipeline

**7 GitHub Actions workflows:**
1. `ci.yml` - Lint, type-check, security scan (TruffleHog, npm audit), build
2. `deploy-staging.yml` - Staging deployment with approval gate
3. `deploy-production.yml` - Production edge function deployment
4. `docker-build.yml` - Multi-stage Docker builds
5. `k8s-deploy.yml` - Kubernetes manifest application
6. `edge-function-deploy.yml` - Supabase function deployment
7. `rollback.yml` - Emergency rollback procedure

---

## 8. KNOWN BUGS & ISSUES

### Critical

| # | Issue | Component | Impact |
|---|-------|-----------|--------|
| 1 | **Exoscale GPU driver incompatibility** | K8s GPU nodes | RTX 6000 PRO Blackwell requires NVIDIA open kernel modules; Exoscale template uses proprietary. GPU workloads cannot run on Exoscale. **Workaround:** Using Modal.com. |
| 2 | **No frontend tests** | Frontend | Zero test coverage across 208,555 lines of code. No unit tests, integration tests, or E2E tests configured. |

### High

| # | Issue | Component | Impact |
|---|-------|-----------|--------|
| 3 | **Stripe webhook no deduplication** | `stripe-webhook` | Duplicate webhook events could process twice (double credit allocation, duplicate subscription updates) |
| 4 | **Docker Hub push failure** | Deployment | PersonaPlex Docker image (4.5GB) fails to push with 400 Bad Request on large layers |
| 5 | **Agent execute code duplication** | Edge Functions | 3 variants (`agent-execute`, `agent-execute-phase2`, `agentexecute2`) with inconsistent feature sets (credit validation, auth methods) |

### Medium

| # | Issue | Component | Impact |
|---|-------|-----------|--------|
| 6 | **SSE memory leak risk** | `agent-logs-phase2` | `setInterval` in `ReadableStream` may leak if client disconnects |
| 7 | **vLLM token estimation** | `chat-completions` | Uses 4 chars/token heuristic for message truncation - inaccurate for non-Latin scripts |
| 8 | **No pagination on analytics** | `analytics` | All analytics queries return unbounded results |
| 9 | **Hardcoded Stripe API version** | `stripe` | Using `2023-10-16` - over 2 years outdated |
| 10 | **Agent terminal JSON path** | `agent-terminal` | `metadata->>path` query may not escape properly |

### Low

| # | Issue | Component | Impact |
|---|-------|-----------|--------|
| 11 | IP-based rate limiting bypass | `ghost-inference` | Proxy/VPN bypasses anonymous rate limits |
| 12 | Generic fallback plan | `agent-plan` | Default plan too generic when AI generation fails |
| 13 | NotebookLM silent failure | `agent-wide-research` | NotebookLM integration fails silently |
| 14 | Hardcoded credit packages | `create-credits-checkout` | $5/$20/$50/$100 not market-flexible |

---

## 9. WHAT IS WORKING (Production-Ready)

| Feature | Evidence |
|---------|----------|
| Multi-model chat routing (6 providers) | Active edge functions with fallback chains |
| End-to-end encrypted chat (AES-256-GCM) | Full crypto stack with key management |
| Ghost Mode (free tier with rate limiting) | DB schema + functions + credit tracking |
| Voice AI (PersonaPlex + Hume) | Deployed on Modal, routing by language |
| Deep research (multi-source) | Perplexity + Gemini + Serper integration |
| Audio briefings (12 languages) | Gemini + OpenAI TTS pipeline |
| Stripe billing (subscriptions + credits) | Full webhook handling |
| OAuth integrations (5 providers) | GitHub, Gmail, Google Drive, Notion, Slack |
| Agent task execution | Multiple execution backends |
| Code sandbox execution | 3-level fallback (K8s → E2B → Modal) |
| Admin dashboard + audit logs | Immutable logging with CSV export |
| Multi-tenant organizations | RLS + role-based access |
| i18n (10 languages) | Full frontend translation |
| Real-time updates | Supabase subscriptions on chat tables |

---

## 10. WHAT IS BUILT BUT NOT YET PRODUCTION-VALIDATED

| Feature | Status | Missing |
|---------|--------|---------|
| Fine-tuning platform | DB + UI complete | GPU compute integration, actual training pipeline |
| VaultMail | DB schema + functions | End-to-end testing, Gmail/Outlook production OAuth approval |
| Healthcare module | 8 functions + schema | HIPAA compliance audit, clinical validation |
| Collaboration (OT) | Backend modules | Real-time conflict resolution testing |
| Browser automation | Modal endpoint | Production sandbox isolation verification |
| Custom agent builder | UI components | Template marketplace, sharing |

---

## 11. SCALE METRICS

| Metric | Value |
|--------|-------|
| Frontend TypeScript lines | ~208,555 |
| Frontend files (TS/TSX) | 817 |
| Component files | 448 |
| Page routes | 81 |
| Backend Python files | 628 |
| Edge Functions | 119 |
| Database migrations | 108+ |
| Database tables | 60+ |
| Storage buckets | 6 |
| K8s clusters | 3 |
| CI/CD workflows | 7 |
| Dockerfiles | 7 |
| API integrations | 18+ |
| Supported languages (i18n) | 10 |
| Supported AI models | 15+ |
| Documentation files | 130+ markdown |

---

## 12. RECOMMENDATIONS FOR ENTERPRISE READINESS

### Immediate (P0)
1. **Implement frontend testing** - Vitest + React Testing Library + Playwright E2E
2. **Add Stripe webhook idempotency** - Event ID deduplication before processing
3. **Consolidate agent-execute variants** - Single implementation with feature flags
4. **Resolve Exoscale GPU driver issue** - File support ticket for open kernel modules

### Short-Term (P1)
5. **Add pagination** to all database queries (analytics, audit logs, usage)
6. **Update Stripe API version** from 2023-10-16 to current
7. **Add request-level rate limiting** on edge functions
8. **Fix SSE stream cleanup** in agent-logs-phase2
9. **Add health checks** for all external API dependencies
10. **Implement structured error telemetry** (Sentry or equivalent)

### Medium-Term (P2)
11. **SOC 2 Type II preparation** - Document controls, access reviews
12. **HIPAA BAA** with Supabase for healthcare module
13. **Penetration testing** - External security audit
14. **Load testing** - Establish throughput baselines
15. **Disaster recovery plan** - Database backup verification, failover procedures
16. **API versioning** - Versioned edge function endpoints

### Long-Term (P3)
17. **Multi-region deployment** - Active-active across Swiss data centers
18. **On-premises deployment package** - K8s Helm charts for enterprise customers
19. **FedRAMP / ISO 27001** certification path
20. **Model serving optimization** - Dedicated inference infrastructure vs. Modal

---

## 13. INVESTOR DUE DILIGENCE SUMMARY

### Technical Moat
- **Client-side E2EE** with zero-knowledge architecture (server never sees plaintext)
- **Multi-provider AI routing** with automatic failover (6+ providers)
- **Swiss data sovereignty** design (Exoscale Geneva, Supabase EU)
- **Voice AI with persona system** (PersonaPlex + Hume multilingual)

### Revenue Architecture
- Tiered SaaS subscriptions (Free → Pro → Enterprise)
- Usage-based credit system with daily limits
- API access with per-key rate limiting
- Ghost Mode freemium funnel

### Technical Debt
- **Moderate** - Some code duplication in agent functions, no test suite
- **Manageable** - Architecture is clean, well-separated concerns
- **Active development** - Recent commits show continuous improvement

### Scalability Assessment
- **Database:** PostgreSQL with RLS scales to millions of rows; pgvector for semantic search
- **Compute:** Serverless edge functions scale automatically; Modal GPU on-demand
- **Storage:** Supabase Storage with configurable bucket limits
- **Real-time:** WebSocket subscriptions via Supabase Realtime
- **Bottleneck:** Agent API (FastAPI) may need horizontal scaling; Redis for job queue

### IP & Differentiation
- Comprehensive encrypted AI platform (rare in market)
- Healthcare-specific module with audit compliance
- Swiss regulatory positioning (FINMA, GDPR, HIPAA-aware)
- Multi-modal: text, voice, image, video, documents, code execution
- Enterprise features: SSO, organization management, audit logging
