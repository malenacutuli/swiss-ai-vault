# MANUS PARITY IMPLEMENTATION STATUS
**Date:** January 19, 2026
**Target:** 100% Manus.im feature parity for Swiss Agents

---

## EXECUTIVE SUMMARY

| Category | Implemented | Partial | Missing | Total |
|----------|-------------|---------|---------|-------|
| Core Services | 4 | 2 | 2 | 8 |
| Agent Tools | 12 | 2 | 1 | 15 |
| AI Features | 8 | 1 | 3 | 12 |
| Infrastructure | 5 | 1 | 2 | 8 |

**Overall Parity: ~85%** (Updated after Jan 19 PM session)

---

## SECTION 1: CORE SERVICES STATUS

### 1.1 Required Services (from spec)

| Service | Status | Location | Notes |
|---------|--------|----------|-------|
| **API Gateway** | ✅ DONE | Supabase Edge Functions | Auth, rate limiting via RLS |
| **Run Service** | ✅ DONE | `run-service` + `agent_runs` table | Full state machine implemented |
| **Agent Service** | ⚠️ PARTIAL | `agent-api/app/research/` | Missing agent lifecycle |
| **Tool Service** | ✅ DONE | Edge functions + Swiss K8s | Code, shell, browser, docs |
| **Worker Executor** | ✅ DONE | `agent-api` + Redis queue | Running on K8s |
| **Billing Engine** | ✅ DONE | `billing-service` + tables | Credit reservation, charging, refunds |
| **Audit Logger** | ⚠️ PARTIAL | `audit-logs` function | Missing compliance features |
| **Collaboration Service** | ❌ MISSING | - | Real-time workspaces |
| **Integration Service** | ✅ DONE | `agent-api/app/connectors/` | GitHub, Slack, Google, etc. |

### 1.2 What's Working Now

```
Current Architecture:
┌─────────────────────────────────────────────────────────┐
│  Frontend (Lovable/React)                               │
│  └── Calls Supabase Edge Functions                      │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase Edge Functions (83 deployed)                  │
│  ├── agent-execute  (task orchestration)                │
│  ├── agent-status   (status tracking)                   │
│  ├── agent-logs     (log streaming)                     │
│  └── ghost-*        (privacy-first inference)           │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│  Swiss K8s API  │ │   Modal     │ │   AI Providers  │
│  (agent-api)    │ │  (browser,  │ │  (Anthropic,    │
│  └── E2B sandbox│ │   docs)     │ │   OpenAI, etc)  │
└─────────────────┘ └─────────────┘ └─────────────────┘
```

---

## SECTION 2: AGENT TOOLS STATUS

### 2.1 Tool Inventory

| Tool | Status | Backend | Notes |
|------|--------|---------|-------|
| **code_execute** | ✅ DONE | Swiss K8s (E2B) | Python, JS, shell |
| **shell_execute** | ✅ DONE | Swiss K8s (E2B) | Full shell access |
| **browser_action** | ✅ DONE | Modal (Playwright) | Screenshots, automation |
| **web_search** | ✅ DONE | Perplexity + Gemini | With grounding |
| **file_read** | ✅ DONE | E2B sandbox | Workspace files |
| **file_write** | ✅ DONE | E2B sandbox | Workspace files |
| **generate_document** | ✅ DONE | Modal | DOCX, PDF |
| **generate_slides** | ✅ DONE | Modal | PPTX generation |
| **generate_image** | ✅ DONE | DALL-E 3, Imagen 3 | Multiple providers |
| **generate_video** | ⚠️ PARTIAL | Edge function | Needs production API |
| **deep_research** | ✅ DONE | `deep-research` | Multi-source synthesis |
| **wide_research** | ✅ DONE | `agent-wide-research` | Parallel agents |
| **data_analysis** | ⚠️ PARTIAL | `agent-api/analysis/` | Basic charts |
| **send_email** | ✅ DONE | `email-action` | send, draft, search, reply, forward |
| **calendar_action** | ✅ DONE | `calendar-action` | create_event, list_events, quick_add |
| **slack_action** | ✅ DONE | `slack-action` | send_message, create_channel, search |
| **github_action** | ✅ DONE | `github-action` | create_issue, create_pr, search_code |
| **notion_action** | ✅ DONE | `notion-action` | create_page, search, query_database |

### 2.2 Missing Tool Implementations

```typescript
// PRIORITY 1: Action tools for existing OAuth connectors
interface SlackAction {
  action: 'send_message' | 'create_channel' | 'search';
  channel?: string;
  message?: string;
  query?: string;
}

interface GitHubAction {
  action: 'create_issue' | 'create_pr' | 'search_code' | 'list_repos';
  repo?: string;
  title?: string;
  body?: string;
  query?: string;
}

interface NotionAction {
  action: 'create_page' | 'update_page' | 'search' | 'add_to_database';
  page_id?: string;
  database_id?: string;
  content?: any;
}

// PRIORITY 2: Calendar and email automation
interface CalendarAction {
  action: 'create_event' | 'list_events' | 'update_event';
  event?: CalendarEvent;
  date_range?: DateRange;
}

interface EmailAction {
  action: 'send' | 'draft' | 'search' | 'reply';
  to?: string[];
  subject?: string;
  body?: string;
  thread_id?: string;
}
```

---

## SECTION 3: AI FEATURES STATUS

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| **Multi-provider routing** | ✅ DONE | `ghost-inference` | Anthropic, OpenAI, Gemini, etc. |
| **Source citations** | ✅ DONE | `_shared/citations`, `deep-research` | DB tables + verification |
| **Follow-up questions** | ✅ DONE | `deep-research` | AI-generated follow-ups |
| **Agent planning** | ⚠️ PARTIAL | `agent-plan` | Needs improvement |
| **Agent memory** | ✅ DONE | IndexedDB + Supabase | Context persistence |
| **RAG (documents)** | ✅ DONE | `embed-document`, `search-documents` | Vector search |
| **Audio briefings** | ✅ DONE | `audio-briefing` | Gemini + TTS |
| **Voice input** | ✅ DONE | `voice` | Whisper transcription |
| **Image understanding** | ✅ DONE | Gemini Vision | Multi-modal |
| **Video understanding** | ✅ DONE | `gemini-video` | Gemini 1.5 |
| **Custom agents** | ❌ MISSING | - | User-defined agents |
| **Content feed** | ❌ MISSING | - | Personalized content |

---

## SECTION 4: RUN LIFECYCLE STATUS

### 4.1 Current State Machine (Simplified)

```
CURRENT:
  created → pending → running → completed/failed

NEEDED (Manus Parity):
  created → pending → running → completed/failed/paused/cancelled
                ↓         ↓
            retrying  resuming
```

### 4.2 Missing State Transitions

| Transition | Status | Priority |
|------------|--------|----------|
| RUNNING → PAUSED | ❌ MISSING | P1 |
| PAUSED → RESUMING | ❌ MISSING | P1 |
| RUNNING → CANCELLED | ⚠️ PARTIAL | P1 |
| FAILED → RETRYING | ❌ MISSING | P1 |
| Timeout handling | ❌ MISSING | P2 |
| Checkpointing | ❌ MISSING | P2 |

---

## SECTION 5: BILLING STATUS

### 5.1 Current Billing

```
CURRENT STATE:
- Stripe integration exists (stripe-webhook)
- Credit checkout exists (create-credits-checkout)
- Basic usage tracking exists (usage-stats)

MISSING:
- Per-run credit tracking
- Credit reservation before execution
- Credit refund on failure
- Collaboration billing (owner pays)
- Rate limiting by credits
```

### 5.2 Required Tables

```sql
-- Need to create these tables
CREATE TABLE billing_ledger (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  run_id UUID,

  -- Transaction
  transaction_type VARCHAR(50), -- 'charge', 'refund', 'purchase', 'bonus'
  credits_amount BIGINT NOT NULL, -- in millicredits

  -- Balance
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,

  -- Metadata
  description TEXT,
  idempotency_key VARCHAR(255) UNIQUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE credit_reservations (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  run_id UUID NOT NULL,

  credits_reserved BIGINT NOT NULL,
  credits_charged BIGINT DEFAULT 0,
  credits_refunded BIGINT DEFAULT 0,

  status VARCHAR(50) DEFAULT 'reserved',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ
);
```

---

## SECTION 6: COLLABORATION STATUS

### 6.1 Current State

```
CURRENT:
- Single-user workspaces only
- No real-time collaboration
- No shared editing
- No permission model beyond owner

NEEDED:
- Multi-user workspaces
- Real-time document sync (OT/CRDT)
- Role-based permissions (viewer, editor, prompter, runner, owner)
- Workspace activity feed
- Collaborative agent runs
```

### 6.2 Required Components

| Component | Status | Priority |
|-----------|--------|----------|
| Workspace sharing | ❌ MISSING | P1 |
| Permission model | ❌ MISSING | P1 |
| Real-time sync | ❌ MISSING | P2 |
| Activity feed | ❌ MISSING | P2 |
| Collaborative runs | ❌ MISSING | P3 |

---

## SECTION 7: IMPLEMENTATION PRIORITIES

### Phase 1: Core Agent Improvements (Week 1-2)
1. ✅ Fix agent-api ingress routing
2. Implement full run state machine
3. Add source citations to research outputs
4. Add retry/resume capabilities

### Phase 2: Tool Actions (Week 2-3)
1. Implement Slack actions (send_message, create_channel)
2. Implement GitHub actions (create_issue, create_pr)
3. Implement email automation (send, draft)
4. Implement calendar actions

### Phase 3: Billing & Credits (Week 3-4)
1. Create billing_ledger table
2. Implement credit reservation
3. Add per-run cost tracking
4. Integrate with agent execution

### Phase 4: Collaboration (Week 4-6)
1. Create workspaces table with sharing
2. Implement permission model
3. Add real-time sync (WebSocket/Supabase Realtime)
4. Create activity feed

### Phase 5: Advanced Features (Week 6+)
1. Custom agent builder
2. Content feed
3. Follow-up questions
4. Advanced analytics

---

## SECTION 8: IMMEDIATE NEXT STEPS

### Today's Focus

1. **Fix API Ingress** (blocking)
   ```bash
   # Consolidate ingress rules
   kubectl delete ingress agent-api-ingress -n agents
   # Route through swissbrain-ingress with proper paths
   ```

2. **Implement Source Citations** (high value)
   - Add to `deep-research` edge function
   - Create citation data model
   - Display in frontend

3. **Add Slack Actions** (quick win)
   - Create `supabase/functions/slack-action/`
   - Use existing OAuth tokens
   - Implement send_message, search

---

## APPENDIX: FILE LOCATIONS

### Edge Functions (supabase/functions/)
```
agent-execute/         # Main task orchestration
agent-status/          # Status tracking
agent-logs/            # Log streaming
agent-plan/            # Task planning
agent-wide-research/   # Parallel research
deep-research/         # Multi-source research
ghost-inference/       # Multi-provider AI
```

### Agent API (agent-api/app/)
```
analysis/              # Data analysis tools
browser/               # Browser session management
connectors/            # OAuth + connector actions
mcp/                   # Model Context Protocol
research/              # Wide research coordination
sandbox/               # E2B sandbox management
scheduler/             # Task scheduling
```

### Frontend (src/)
```
components/agents/     # Agent UI components
pages/agents/          # Agent pages
hooks/useAgent*.ts     # Agent hooks
types/agent.ts         # Agent types
```

---

*Document generated: January 19, 2026*
*Next update: After Phase 1 completion*
