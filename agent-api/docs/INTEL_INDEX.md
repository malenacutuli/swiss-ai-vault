# SwissBrain Intel Index

**Status**: CANONICAL SOURCE OF TRUTH
**Created**: 2026-01-16
**Last Scanned**: 2026-01-18
**Repo**: `/Users/malena/swiss-ai-vault/agent-api`

---

## Document Table

| Filename | System | Subsystem | Key Invariants | Code Locations |
|----------|--------|-----------|----------------|----------------|
| `SWISSBRAIN_INTELLIGENCE_STACK.md` | Agent Intelligence | Planner Agent | ACCEPT=0.7, REPAIR=0.4, MAX_REPAIRS=3, MAX_PLANNING_TIME_MS=30000 | `app/agent/plan_scorer.py` |
| `SWISSBRAIN_INTELLIGENCE_STACK.md` | Agent Intelligence | Research Orchestration | DEPTH_TIME_BUDGETS={shallow:15s, medium:45s, deep:120s}, NO_NEW_FACTS_TIMEOUT_MS=30000 | `app/research/coordinator.py`, `app/research/synthesizer.py` |
| `SWISSBRAIN_INTELLIGENCE_STACK.md` | Agent Intelligence | Confidence Scoring | hedging>=0.9:none, >=0.7:light, >=0.5:moderate, >=0.3:heavy, <0.3:maximum | `app/confidence/scorer.py` |
| `SWISSBRAIN_INTELLIGENCE_STACK.md` | Agent Intelligence | Presentation | slide_count=duration_minutes, narrative_structure=[hook,context,tension,journey,resolution,cta] | `app/presentation/` (TODO) |
| `SWISSBRAIN_INTELLIGENCE_STACK.md` | Agent Intelligence | Visualization | reject_pie_if_categories>7, reject_3d_always, reject_dual_axis_always | `app/presentation/visual_validator.py` (TODO) |
| `SWISSBRAIN_INTELLIGENCE_STACK.md` | Agent Intelligence | Collaboration | human_deletions_are_intentional, ai_deletions_need_confirmation, human_wins_default | `app/collaboration/conflict_resolver.py` (TODO) |
| `SWISSBRAIN_INTELLIGENCE_STACK.md` | Agent Intelligence | Email Ingestion | REQUIRE_DKIM=true, REQUIRE_SPF=true, MAX_TASKS_PER_HOUR=10, BLOCKED_ACTIONS=[delete_account,change_password,export_all_data] | `app/ingest/email_parser.py` (TODO) |
| `docs/PHASE5_PROMPT_MANAGEMENT.md` | Prompt Management | Version Manager | status=[draft,active,archived,deprecated], UNIQUE(prompt_id,version) | `app/prompts/version_manager.py` |
| `docs/PHASE5_PROMPT_MANAGEMENT.md` | Prompt Management | Template System | variables={{variable}}, auto_extraction | `app/prompts/template_system.py` |
| `docs/PHASE5_PROMPT_MANAGEMENT.md` | Prompt Management | A/B Testing | split=0.5_default, min_samples=30_per_variant, status=[running,completed,archived] | `app/prompts/ab_testing.py` |
| `docs/PHASE5_PROMPT_MANAGEMENT.md` | Prompt Management | Metrics | record_all_executions, clean_up_90_days | `app/prompts/metrics.py` |
| `docs/PHASE5_PROMPT_MANAGEMENT.md` | Prompt Management | Optimizer | auto_activate_best_version, context_aware_selection_future | `app/prompts/optimizer.py` |
| `SWISSBRAIN_DESIGN_PATTERNS_GUIDE.md` | Frontend | UI Components | 45+ shadcn components, CVA patterns, cn() utility | `frontend/src/components/ui/` |
| `SWISSBRAIN_DESIGN_PATTERNS_GUIDE.md` | Frontend | Styling | CSS variables for theming, dark mode support | `frontend/src/index.css` |
| `PHASE7_INTEGRATION_IMPLEMENTATION.md` | Agent Integration | Wide Research | WideResearchJobManager, ParallelAgentCoordinator, ResultSynthesizer | `app/research/`, `app/routes/research.py` |
| `PHASE8_COMPLETE.md` | Advanced Features | Task Scheduler | cron expressions, pause/resume, execution_history | `app/scheduler/task_scheduler.py` |
| `PHASE8_COMPLETE.md` | Advanced Features | Data Analyzer | field_type_detection, statistics=[min,max,avg], chart_data_generation | `app/analysis/data_analyzer.py` |
| `PHASE8_COMPLETE.md` | Advanced Features | Browser Sessions | session_lifecycle, navigation_history, multi_session | `app/browser/session_manager.py` |
| `PHASE8_COMPLETE.md` | Advanced Features | MCP Protocol | v1.0, methods=[initialize,tools/list,tools/call,resources/list,resources/read] | `app/mcp/protocol_handler.py` |
| `docs/runbooks/PLAN_SCORING.md` | Operations | Plan Scoring Runbook | alert_abort_rate>0.1, alert_accept_rate<0.5, alert_p95_latency>1s | N/A (Runbook) |
| `docs/specs/SLIDE_GENERATION_SPEC.md` | Slide Generation | Architecture | modes=[html,image], html=editable, image=non-editable | `app/slides/` (TODO) |
| `docs/specs/SLIDE_GENERATION_SPEC.md` | Slide Generation | Content Constraints | max_headline_words=10, max_subheadline_words=15, max_bullet_points=6, max_words_per_bullet=25 | `app/slides/content_validator.py` (TODO) |
| `docs/specs/SLIDE_GENERATION_SPEC.md` | Slide Generation | Nano Banana Styles | 15 styles: vinyl,whiteboard,grove,fresco,easel,diorama,chromatic,sketch,amber,ginkgo,neon,paper,blueprint,polaroid,mosaic | `app/slides/styles/` (TODO) |
| `docs/specs/SLIDE_GENERATION_SPEC.md` | Slide Generation | Image Pipeline | dimensions=[1920x1080 for 16:9, 1920x1440 for 4:3, 1080x1080 for 1:1], text_overlays, compositor | `app/slides/image_pipeline.py` (TODO) |
| `docs/specs/SLIDE_GENERATION_SPEC.md` | Slide Generation | HTML Mode | Chart.js integration, CSS variables for theming, themes=[dark,light,corporate,creative] | `app/slides/html_renderer.py` (TODO) |
| `docs/specs/SLIDE_GENERATION_SPEC.md` | Slide Generation | Slide Types | types=[title,content,section,data,quote,image,comparison,timeline,conclusion], title_must_be_first, conclusion_should_be_last | `app/slides/slide_types.py` (TODO) |

---

## Golden Invariants

These are non-negotiable constraints that MUST be preserved across all implementations:

### Planner Agent
1. **ACCEPT threshold = 0.7** - Plans scoring >= 0.7 execute without repair
2. **REPAIR threshold = 0.4** - Plans scoring 0.4-0.7 attempt repair
3. **REGENERATE threshold < 0.4** - Plans scoring < 0.4 start over
4. **MAX_REPAIR_ATTEMPTS = 3** - Stop repairing after 3 attempts
5. **MAX_REGENERATION_ATTEMPTS = 2** - Maximum 2 regeneration cycles
6. **MAX_PLANNING_TIME_MS = 30000** - 30 second hard limit on planning
7. **MAX_REPAIR_TIME_MS = 60000** - 60 second total repair budget
8. **Composite Score Weights** - feasibility:0.35, completeness:0.35, efficiency:0.15, risk_adjusted:0.15

### Research Orchestration
9. **NO_NEW_FACTS_TIMEOUT_MS = 30000** - Abort if no new facts for 30 seconds
10. **MIN_FACT_RATE = 0.1** - Minimum 1 fact per 10 seconds after 30s
11. **MAX_SOURCES_PER_TASK = 15** - Don't read more than 15 sources per task
12. **MAX_PARALLEL_TASKS = 10** - Maximum 10 concurrent research tasks
13. **MIN_SOURCE_QUALITY = 0.3** - Don't read sources scoring below 0.3
14. **MIN_RELEVANCE_FOR_SYNTHESIS = 0.5** - Only synthesize sources >= 0.5 relevance

### Confidence Scoring
15. **>=0.9 = no hedging** - "The data shows..."
16. **>=0.7 = light hedging** - "The data suggests..."
17. **>=0.5 = moderate hedging** - "The data appears to show..."
18. **>=0.3 = heavy hedging** - "Limited data suggests..."
19. **<0.3 = maximum hedging** - "It is unclear..."
20. **UI: >=0.8 = no indicator** - Don't show uncertainty for high confidence
21. **UI: >=0.5 = subtle indicator** - Show tooltip "Based on limited sources"
22. **UI: <0.5 = prominent warning** - Show "Highly uncertain - verify before using"

### Visualization Rejection
23. **REJECT pie charts if categories > 7** - Use bar chart or group into "Other"
24. **REJECT pie charts if not part-of-whole** - Sum must be ~100% or ~1.0
25. **REJECT line charts for non-sequential data** - Require sequential x-axis
26. **REJECT all 3D charts** - 3D distorts perception
27. **REJECT dual-axis charts** - Misleading correlation implications
28. **REJECT if variance < 5%** - Data too similar to visualize meaningfully

### Collaboration Conflict Resolution
29. **Human deletions are intentional** - Always accept human deletions
30. **AI deletions need confirmation** - Never auto-delete human-modified content
31. **Human wins by default** - When in doubt, preserve human intent
32. **Style conflicts → AI yields** - Style preference deferred to human

### Email Security
33. **REQUIRE_DKIM = true** - Reject unsigned emails
34. **REQUIRE_SPF = true** - Verify sender domain
35. **MAX_TASKS_PER_HOUR = 10** - Rate limit task creation from email
36. **BLOCKED_ACTIONS** = [delete_account, change_password, export_all_data]
37. **ALWAYS_CONFIRM_ACTIONS** = [send_email, publish, payment, booking, share_externally]

### Prompt Management
38. **Version uniqueness** - UNIQUE(prompt_id, version)
39. **A/B test minimum samples = 30 per variant** - Statistical significance requirement
40. **Metrics retention = 90 days** - Clean up after 90 days

### Slide Generation
41. **Two generation modes** - 'html' (editable) or 'image' (non-editable)
42. **max_headline_words = 10** - Headlines must be concise
43. **max_subheadline_words = 15** - Subheadlines slightly longer
44. **max_bullet_points = 6** - No more than 6 bullets per slide
45. **max_words_per_bullet = 25** - Keep bullets readable
46. **Title slide must be first** - Structural requirement
47. **Conclusion/CTA slide should be last** - Structural requirement
48. **Image dimensions: 16:9 = 1920x1080** - Standard HD resolution
49. **Image dimensions: 4:3 = 1920x1440** - Legacy format
50. **Image dimensions: 1:1 = 1080x1080** - Square format (social)
51. **15 Nano Banana styles** - vinyl, whiteboard, grove, fresco, easel, diorama, chromatic, sketch, amber, ginkgo, neon, paper, blueprint, polaroid, mosaic
52. **Default style = chromatic** - When no explicit style requested
53. **Content-based style selection** - Map content theme to appropriate style
54. **Chart.js for HTML mode visualizations** - No other charting library
55. **CSS variables for theming** - --slide-bg, --slide-text, --slide-accent, --slide-muted, --font-headline, --font-body
56. **Slide types** - title, content, section, data, quote, image, comparison, timeline, conclusion
57. **Data slides must include chart type** - Recommendation required for data slides
58. **Text overlay composition** - Upper third for headlines, center for body
59. **Visual balance** - 60% content area, 40% visual/whitespace
60. **Single focal point per slide** - Clear visual hierarchy

---

## Doc Conflicts / Ambiguities

### CONFLICT-001: Presentation Slide Count Formula
**Location**: `SWISSBRAIN_INTELLIGENCE_STACK.md` Section 3.2
**Issue**: Spec says "1-2 minutes per slide" but also "target = duration_minutes" (1 slide/minute)
**Conflict**: Min/max range (0.5-1.5 slides/min) vs target (1 slide/min) unclear for edge cases
**Resolution Required**: Clarify whether to use min, max, or target for automated generation

### CONFLICT-002: Research Abort vs Continue Semantics
**Location**: `SWISSBRAIN_INTELLIGENCE_STACK.md` Section 2.2
**Issue**: "RULE 1: No new facts in 30 seconds" and "RULE 2: Fact density too low" can conflict
**Conflict**: If fact_rate is 0.08 (below 0.1) but a new fact just arrived, which rule wins?
**Resolution Required**: Define rule priority order or combine into single condition

### CONFLICT-003: Source Quality vs Relevance Thresholds
**Location**: `SWISSBRAIN_INTELLIGENCE_STACK.md` Section 2.3
**Issue**: MIN_SOURCE_QUALITY=0.3 vs MIN_RELEVANCE_FOR_SYNTHESIS=0.5
**Conflict**: Can read source at 0.35 quality but then not include it at 0.45 relevance?
**Resolution Required**: Clarify relationship between quality (read gate) and relevance (synthesis gate)

### AMBIGUITY-001: Confidence Score Sources
**Location**: `SWISSBRAIN_INTELLIGENCE_STACK.md` Section 7
**Issue**: Spec shows confidence_to_language mapping but no specification of how confidence is calculated
**Gap**: What inputs feed into the confidence score? Source count? Agreement? Freshness?
**Resolution Required**: Define confidence calculation formula or model

### AMBIGUITY-002: A/B Test Winner Determination
**Location**: `docs/PHASE5_PROMPT_MANAGEMENT.md` Section 3
**Issue**: "Statistical winner determination" mentioned but no formula specified
**Gap**: What statistical test? p-value threshold? Minimum effect size?
**Resolution Required**: Define statistical significance criteria

### AMBIGUITY-003: Email Classification Threshold
**Location**: `SWISSBRAIN_INTELLIGENCE_STACK.md` Section 6.1
**Issue**: Classification returns confidence (0.6-0.8) but no threshold for "uncertain"
**Gap**: At what confidence do we ask for human confirmation?
**Resolution Required**: Define minimum confidence for automated task creation

### AMBIGUITY-004: Phase 8 Database Persistence
**Location**: `PHASE8_COMPLETE.md`
**Issue**: "Database Persistence" listed as "Near-Term" but no schema defined
**Gap**: Task scheduler and browser sessions use in-memory storage only
**Resolution Required**: Define database schema for persistence

---

## Do Not Build Until Answered

These questions MUST be resolved before implementing the associated features:

### Critical (Blocks Implementation)

- [ ] **Q1**: What is the confidence calculation formula? (Blocks: `app/confidence/scorer.py` completion)
- [ ] **Q2**: What statistical test determines A/B test winners? (Blocks: `app/prompts/ab_testing.py` winner logic)
- [ ] **Q3**: What is the minimum confidence for automated email task creation? (Blocks: `app/ingest/email_parser.py`)
- [ ] **Q4**: What is the retry semantic for failed plan repairs? (exponential backoff? immediate? cooldown?)
- [ ] **Q5**: What happens when MAX_PLANNING_TIME_MS is reached mid-repair? (abort? return best-so-far?)

### High Priority (Blocks Production)

- [ ] **Q6**: What is the idempotency key format for plan scoring sessions?
- [ ] **Q7**: What Prometheus metrics are required for SLO compliance?
- [ ] **Q8**: What is the data retention policy for research results?
- [ ] **Q9**: How are enterprise policies (NOT_IMPLEMENTED_ENTERPRISE_GAP) surfaced to users?
- [ ] **Q10**: What is the rollback procedure for failed prompt version activations?

### Medium Priority (Blocks Enterprise)

- [ ] **Q11**: What RBAC roles exist for prompt management? (admin/editor/viewer?)
- [ ] **Q12**: What audit log entries are required for compliance?
- [ ] **Q13**: What is the rate limit for API endpoints?
- [ ] **Q14**: How are MCP protocol errors surfaced to external integrators?
- [ ] **Q15**: What is the SLO target for plan scoring latency?

---

## Build Order (Dependency Graph)

```
Level 0 (Foundation - No Dependencies):
├── app/config/feature_flags.py (if not exists)
├── app/utils/metrics.py (Prometheus instrumentation)
└── app/utils/idempotency.py (idempotency key management)

Level 1 (Core Scoring):
├── app/agent/plan_scorer.py ✅ IMPLEMENTED
│   └── Depends on: feature_flags, metrics
├── app/confidence/scorer.py ✅ PARTIAL (needs confidence calc formula)
│   └── Depends on: feature_flags, metrics
└── app/prompts/ ✅ IMPLEMENTED (Phase 5)
    └── Depends on: Supabase, feature_flags

Level 2 (Research & Presentation):
├── app/research/ ✅ IMPLEMENTED (Phase 7)
│   └── Depends on: plan_scorer (for research plan scoring)
├── app/presentation/narrative_builder.py (TODO)
│   └── Depends on: confidence/scorer
└── app/presentation/visual_validator.py (TODO)
    └── Depends on: none

Level 3 (Integration):
├── app/collaboration/conflict_resolver.py (TODO)
│   └── Depends on: none (standalone conflict rules)
├── app/ingest/email_parser.py (TODO)
│   └── Depends on: confidence/scorer (for classification confidence)
└── app/scheduler/ ✅ IMPLEMENTED (Phase 8)
    └── Depends on: Supabase (for persistence - TODO)

Level 4 (Advanced Features):
├── app/analysis/ ✅ IMPLEMENTED (Phase 8)
├── app/browser/ ✅ IMPLEMENTED (Phase 8)
└── app/mcp/ ✅ IMPLEMENTED (Phase 8)

Level 5 (Slide Generation - NEW):
├── app/slides/content_validator.py (TODO)
│   └── Depends on: none
├── app/slides/html_renderer.py (TODO)
│   └── Depends on: content_validator
├── app/slides/image_pipeline.py (TODO)
│   └── Depends on: content_validator, AI image generation service
├── app/slides/styles/ (TODO) - 15 style configs
│   └── Depends on: none (configuration only)
└── app/slides/slide_types.py (TODO)
    └── Depends on: none

Level 6 (Runbooks & Monitoring):
├── docs/runbooks/PLAN_SCORING.md ✅ IMPLEMENTED
├── docs/runbooks/CONFIDENCE_SCORING.md (TODO)
├── docs/runbooks/RESEARCH.md (TODO)
├── docs/runbooks/PROMPT_MANAGEMENT.md (TODO)
└── docs/runbooks/SLIDE_GENERATION.md (TODO)
```

---

## Implementation Status Summary

| System | Status | Tests | Runbook | Metrics | Alerts |
|--------|--------|-------|---------|---------|--------|
| Plan Scoring | ✅ Complete | ✅ 40 tests | ✅ Yes | ✅ Yes | ✅ Yes |
| Confidence Scoring | 🔄 Partial | 🔄 Partial | ❌ No | ❌ No | ❌ No |
| Research Orchestration | ✅ Complete | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Presentation Builder | ❌ TODO | ❌ No | ❌ No | ❌ No | ❌ No |
| Visual Validator | ❌ TODO | ❌ No | ❌ No | ❌ No | ❌ No |
| Conflict Resolver | ❌ TODO | ❌ No | ❌ No | ❌ No | ❌ No |
| Email Parser | ❌ TODO | ❌ No | ❌ No | ❌ No | ❌ No |
| Prompt Management | ✅ Complete | ✅ Yes | ❌ No | ✅ Partial | ❌ No |
| Task Scheduler | ✅ Complete | ✅ 7 tests | ❌ No | ❌ No | ❌ No |
| Data Analyzer | ✅ Complete | ✅ 7 tests | ❌ No | ❌ No | ❌ No |
| Browser Sessions | ✅ Complete | ✅ 7 tests | ❌ No | ❌ No | ❌ No |
| MCP Protocol | ✅ Complete | ✅ 6 tests | ❌ No | ❌ No | ❌ No |
| Slide Generation (HTML) | ❌ TODO | ❌ No | ❌ No | ❌ No | ❌ No |
| Slide Generation (Image) | ❌ TODO | ❌ No | ❌ No | ❌ No | ❌ No |
| Nano Banana Styles (15) | ❌ TODO | ❌ No | ❌ No | ❌ No | ❌ No |

---

## References

- Main Spec: `SWISSBRAIN_INTELLIGENCE_STACK.md`
- Prompt Spec: `docs/PHASE5_PROMPT_MANAGEMENT.md`
- Frontend Spec: `SWISSBRAIN_DESIGN_PATTERNS_GUIDE.md`
- **Slide Generation Spec**: `docs/specs/SLIDE_GENERATION_SPEC.md` (NEW)
- Differentiators (Pending): `SWISSBRAIN_DIFFERENTIATORS.md`
- Phase 7 Implementation: `PHASE7_INTEGRATION_IMPLEMENTATION.md`
- Phase 8 Implementation: `PHASE8_COMPLETE.md`

---

**Intel Index Version**: 1.1.0
**Last Updated**: 2026-01-18
**Next Review**: After resolving "Do Not Build Until Answered" items
