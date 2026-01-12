# SwissVault.ai - VALIDATED COMPLETE CONTEXT
## January 8, 2026 - Claude's Comprehensive Analysis

---

# EXECUTIVE SUMMARY

**Project**: SwissVault.ai - "ProtonMail for AI"
**Position**: Swiss-hosted, privacy-first AI platform
**Target Market**: European enterprises (banks, law firms, healthcare, UHNWIs)
**Founder**: Malena Cutuli (malena@axessible.ai)
**Status**: ~50-70% functional (depending on feature area)
**Seed Target**: €2-5M

---

# SECTION 1: WHAT'S ACTUALLY WORKING ✅

## 1.1 Infrastructure
| Component | Status | Details |
|-----------|--------|---------|
| Supabase | ✅ Working | ID: ghmmdochvlrnwbruyrqk |
| Database | ✅ Working | 66+ tables, 100% RLS enabled |
| Auth | ✅ Working | Email, Google, GitHub OAuth |
| Frontend | ✅ Working | React + TypeScript + Tailwind (Lovable) |
| Edge Functions | ✅ Working | 37+ deployed |

## 1.2 Modal Deployments (5 Live Apps)
| App | Endpoint | Status |
|-----|----------|--------|
| swissvault-agents | https://axessible-labs--swissvault-agents-execute-task-endpoint.modal.run | ✅ Deployed Jan 7 |
| swissvault-document-gen | generate_docx, generate_pptx, generate_xlsx | ✅ Deployed |
| swissvault-llama8b | llama8b_chat | ✅ Deployed |
| swissvault-fast | fast_chat | ✅ Deployed |
| swissvault-main | main_chat | ✅ Deployed |

## 1.3 AI Provider Integrations (ALL Configured)
| Provider | Models | API Key Secret | Status |
|----------|--------|----------------|--------|
| OpenAI | GPT-4o, GPT-4o-mini, o1, o3, DALL-E 3, Whisper, TTS | OPENAI_API_KEY | ✅ |
| Anthropic | Claude Sonnet 4, Claude Haiku | ANTHROPIC_API_KEY | ✅ |
| Google | Gemini 2.5 Flash/Pro, Gemini 3, Imagen 3 | GOOGLE_GEMINI_API_KEY | ✅ |
| DeepSeek | DeepSeek V3, R1 | DEEPSEEK_API_KEY | ✅ |
| xAI | Grok 2, Grok 3 | XAI_API_KEY | ✅ |
| Perplexity | Sonar, Sonar-pro | PERPLEXITY_API_KEY | ✅ |
| Modal | SwissVault hosted (Llama, Mistral, Qwen) | MODAL_TOKEN_ID + MODAL_TOKEN_SECRET | ✅ |

## 1.4 Core Features Working
- ✅ Multi-provider inference routing (ghost-inference)
- ✅ VaultChat with encrypted_conversations (keys persist)
- ✅ Fine-tuning pipeline (5/6 jobs completed)
- ✅ Document embedding and RAG
- ✅ OAuth integrations (Slack, GitHub, Gmail, Google Drive, Notion)
- ✅ Audio briefings (Gemini script + OpenAI TTS)
- ✅ Research (Perplexity + Gemini grounding)
- ✅ Billing/Stripe integration

---

# SECTION 2: KNOWN BUGS TO FIX 🔴

## 2.1 Security Issues (P0)
| Issue | Location | Fix |
|-------|----------|-----|
| Public URLs for user files | agent-execute line 951, Agents.tsx line 164 | Replace `getPublicUrl()` with `createSignedUrl()` |

## 2.2 Code Bugs (P1)
| Issue | Location | Fix |
|-------|----------|-----|
| Wrong model name | AgentsStudio.tsx line 263 | Change `'google/gemini-2.5-flash'` to `'gemini-2.5-flash'` |
| Modal endpoint not validated | agent-execute | Add validation and fallback |
| Audio fails silently | agent-execute lines 815-843 | Return clear audio vs script-only status |

## 2.3 UI Issues
| Issue | Location | Fix |
|-------|----------|-----|
| Settings page | /settings | Returns 404 |
| Upgrade link | Sidebar | Returns 404 |
| GhostPricing shows $20 | GhostPricing.tsx | Should be $18 |

---

# SECTION 3: ARCHITECTURE DETAILS

## 3.1 Privacy Architecture (NON-NEGOTIABLE)
```
DOCUMENTS NEVER LEAVE THE BROWSER
Only top-K chunks (~200 tokens each) sent to AI
This is NON-NEGOTIABLE

TIER 1: GHOST MODE (Maximum Privacy)
├── Documents: IndexedDB only (never leave browser)
├── Embeddings: Transformers.js (local, 384-dim)
├── RAG: client-vector-search (local, ~88ms)
├── AI: Only top-K chunks sent (3-5 snippets)
└── Features: Basic chat, local search, memory

TIER 2: VAULT MODE (Swiss-Protected)
├── Documents: Swiss S3 (eu-central-2 Zurich)
├── Embeddings: text-embedding-004 (768-dim)
├── RAG: pgvector on Supabase (Swiss region)
├── AI: Context injection with citations
└── Features: + Grounded responses, semantic cache

TIER 3: INTELLIGENCE MODE (Maximum Features)
├── Documents: Google Cloud (with explicit consent)
├── Processing: NotebookLM Enterprise API
├── AI: Full Gemini 3 Pro with 1M+ context
└── Features: + Audio briefings, Deep Research, Agents
```

## 3.2 Model Selection Strategy
```
DEFAULT = gemini-2.5-flash (50 RPM)
NEVER USE = gemini-2.0-flash-exp (10 RPM) ← Causes 429 errors

FALLBACK CHAIN (for non-Google tasks):
gpt-4o-mini → claude-haiku → deepseek → swiss-hosted

GOOGLE-FIRST RATIONALE:
- Swiss data residency via Vertex AI europe-west6
- NotebookLM capabilities
- TTS with 30 voices
- Deep Research
- Veo 3.1 video generation
```

## 3.3 Edge Function JWT Configuration
| Function | JWT | Reason |
|----------|-----|--------|
| ghost-inference | ❌ OFF | Anonymous 10/day trial (IP tracking via check_anonymous_usage) |
| ghost-web-search | ❌ OFF | Anonymous trial |
| ghost-deep-research | ❌ OFF | Anonymous trial (2/day limit) |
| agent-logs | ❌ OFF | Public read for task tracking |
| agent-templates-list | ❌ OFF | Public templates |
| All others | ✅ ON | Requires authentication |

## 3.4 Database Schema (Key Tables)
### Agent System (8 tables)
- agent_tasks: Main task records
- agent_task_steps: Step-by-step progress
- agent_task_logs: Execution logs
- agent_outputs: Generated files
- agent_sources: Web citations
- agent_reasoning: AI reasoning traces
- action_templates: 55+ templates
- scheduled_tasks: Cron automation

### Chat System (5 tables)
- encrypted_conversations: E2E encrypted chats (PRIMARY)
- encrypted_messages: Encrypted message content
- conversation_keys: Wrapped encryption keys
- chat_conversations: Legacy (DO NOT USE)
- vault_chat_conversations: Vault Chat specific

### ML Platform (8 tables)
- datasets, dataset_snapshots
- finetuning_jobs, finetuning_templates
- evaluations, experiments, models, deployments

---

# SECTION 4: TASK ROUTING (agent-execute)

| Task Type | Backend | Model/Service | Output |
|-----------|---------|---------------|--------|
| `slides`, `presentation` | Modal | pptxgenjs | .pptx file |
| `document`, `report` | Modal | docx generation | .docx file |
| `spreadsheet` | Modal | xlsx generation | .xlsx file |
| `research` | Modal | Report generation | .md/.docx |
| `flashcards` | Inference | gemini-2.5-flash | JSON/Markdown |
| `quiz` | Inference | gemini-2.5-flash | JSON/Markdown |
| `mind_map` | Inference | gemini-2.5-flash | JSON/Markdown |
| `general`, `chat` | Inference | gemini-2.5-flash | Text |
| `audio_summary`, `podcast` | Gemini TTS | Gemini + OpenAI TTS | MP3 + Script |
| `video_summary` | Veo | NOT IMPLEMENTED | Error message |

---

# SECTION 5: DESIGN SYSTEM

## 5.1 Theme Rules
```
LANDING PAGE: Dark (#0A0F1A background)
APP/DASHBOARD: Light (white/gray background)
ACCENT COLOR: Burgundy #722F37

RULES (NON-NEGOTIABLE):
- NO emojis anywhere - use Lucide icons only
- NO gradients - flat, elegant colors
- Max 8px border radius
- Generous white space (24px card padding)
- Smooth 200ms transitions
```

## 5.2 Swiss Luxury Design System
```css
/* Colors */
swissNavy: '#1A365D'
midnightSapphire: '#0F4C81'
imperialBurgundy: '#722F37'
sovereignTeal: '#1D4E5F'

/* Typography */
.swiss-heading { font-family: 'Playfair Display'; }
.swiss-body { font-family: 'Inter'; }
.swiss-mono { font-family: 'JetBrains Mono'; }

/* Interactions */
.swiss-hover: hover:bg-opacity transitions
.swiss-focus: focus:ring-2 ring-offset-2
.swiss-border: border-radius: 6px
.swiss-glow: box-shadow effects
```

---

# SECTION 6: PRICING TIERS

| Tier | Monthly | Daily Limit | Features |
|------|---------|-------------|----------|
| Free | $0 | 10 text / 2 images | Basic Ghost Chat |
| Ghost Pro | $18 | Unlimited | All Ghost features |
| Premium | $30 | Unlimited + 10 research | Deep Research, Vault features |
| Enterprise | Custom | Unlimited | All features, SLA, custom integrations |

---

# SECTION 7: CRITICAL FILES REFERENCE

## Project Knowledge Files
| File | Purpose |
|------|---------|
| SWISSVAULT_COMPLETE_CONTEXT_JAN6_2026.md | Infrastructure reference |
| SWISSVAULT_HONEST_AUDIT_JAN7_2026.md | Honest status assessment |
| SWISSVAULT_ACTUAL_CODEBASE_ANALYSIS_JAN8.md | Edge function analysis |
| SWISSVAULT_COMPLETE_CODEBASE_ANALYSIS_JAN8.md | Full codebase review |
| SWISS_AGENTS_DOCUMENT_GENERATION_PROMPTS.md | PPTX/DOCX/XLSX generation |
| SWISS_AGENTS_GAP_ANALYSIS.md | Bug analysis |

---

# SECTION 8: VALIDATION CHECKLIST

Before proposing ANY changes, verify:
- [ ] Does this conflict with existing edge function signatures?
- [ ] Does this match the actual database schema?
- [ ] Does this follow the privacy architecture (no docs leave browser)?
- [ ] Does this use gemini-2.5-flash as default (not gemini-exp)?
- [ ] Does this avoid emojis (use Lucide icons)?
- [ ] Does this match the Swiss Luxury design system?
- [ ] Landing page = DARK, App = LIGHT?
- [ ] Am I creating duplicate functionality?
- [ ] Will this work with existing hook patterns?

---

# SECTION 9: QUICK FIX PROMPTS READY

## Security Fix - Signed URLs
```typescript
// Replace in agent-execute and Agents.tsx:
// FROM:
const { data: urlData } = supabase.storage
  .from("agent-outputs")
  .getPublicUrl(path);
return urlData.publicUrl;

// TO:
const { data: signedUrlData } = await supabase.storage
  .from("agent-outputs")
  .createSignedUrl(path, 604800); // 7 days
return signedUrlData.signedUrl;
```

## Bug Fix - Model Name
```typescript
// In AgentsStudio.tsx line 263:
// FROM:
model: 'google/gemini-2.5-flash',
// TO:
model: 'gemini-2.5-flash',
```

---

# END OF VALIDATED CONTEXT

**Created**: January 8, 2026
**Source**: Analysis of 70+ project files, 20+ past conversations, and current memory
**Status**: Complete and validated
