# SwissBrain Risk Assessment - Top 10 Gaps

**Status**: CANONICAL RISK REGISTER
**Created**: 2026-01-16
**Intel Source**: `docs/INTEL_INDEX.md`

---

## Risk Assessment Criteria

| Severity | Definition |
|----------|------------|
| CRITICAL | Blocks production deployment or causes data loss/security breach |
| HIGH | Causes incorrect behavior or poor user experience at scale |
| MEDIUM | Degrades performance or limits functionality |
| LOW | Minor inconvenience or missing nice-to-have feature |

| Recommendation | Definition |
|----------------|------------|
| IMPLEMENT_NOW | Safe to implement immediately per spec |
| FEATURE_FLAG | Implement behind flag, enable after validation |
| REQUIRES_DECISION | Blocked until spec clarification received |

---

## Top 10 Highest-Risk Gaps

### RISK-001: Confidence Score Calculation Undefined
**Severity**: CRITICAL
**System**: Confidence Scoring (`app/confidence/scorer.py`)
**Recommendation**: REQUIRES_DECISION

**Gap Description**:
The spec defines `confidence_to_language()` and `confidence_to_ui_display()` mappings but does NOT specify how the input confidence score is calculated. Without this, the entire confidence/hedging system produces arbitrary results.

**Impact**:
- Users receive inconsistent hedging language
- UI indicators are unreliable
- Research synthesis quality scores are meaningless

**Required Decision**:
```
Define confidence calculation formula. Options:
A) Source agreement model: confidence = agreement_ratio * source_count_weight
B) Freshness-weighted: confidence = sum(source_freshness * source_authority) / n
C) ML-based: fine-tune classifier on labeled research quality data
D) Hybrid: combine source count, agreement, freshness, authority
```

**Blocked Items**: Confidence scoring completion, Email classification, Research synthesis quality

---

### RISK-002: A/B Test Statistical Significance Undefined
**Severity**: HIGH
**System**: Prompt Management (`app/prompts/ab_testing.py`)
**Recommendation**: REQUIRES_DECISION

**Gap Description**:
The spec mentions "Statistical winner determination" and "minimum 30 samples per variant" but does not specify:
- Which statistical test to use (t-test, chi-square, Bayesian)
- The p-value threshold for significance
- Minimum effect size to declare a winner
- How to handle inconclusive results

**Impact**:
- Incorrect prompt version promotions
- Wasted A/B test time with no actionable results
- False positives leading to worse prompts in production

**Required Decision**:
```
Define statistical winner criteria:
- Test type: [t-test for latency, chi-square for success rate, or both]
- p-value threshold: [0.05 standard, 0.01 conservative]
- Minimum effect size: [5% improvement? 10%?]
- Inconclusive handling: [continue test, default to control, manual review]
```

**Blocked Items**: `complete_test()` winner logic, auto-optimization

---

### RISK-003: Missing Runbooks for Critical Systems
**Severity**: HIGH
**System**: Operations
**Recommendation**: IMPLEMENT_NOW

**Gap Description**:
Only Plan Scoring has a runbook. Critical systems lack operational documentation:
- Confidence Scoring - no runbook
- Research Orchestration - no runbook
- Prompt Management - no runbook
- Email Ingestion - no runbook

**Impact**:
- On-call engineers cannot diagnose issues
- No standard recovery procedures
- Extended incident resolution time

**Action Plan**:
```
Create runbooks following PLAN_SCORING.md template:
1. docs/runbooks/CONFIDENCE_SCORING.md
2. docs/runbooks/RESEARCH_ORCHESTRATION.md
3. docs/runbooks/PROMPT_MANAGEMENT.md
4. docs/runbooks/EMAIL_INGESTION.md (when implemented)

Each must include:
- Key thresholds
- Monitoring queries (PromQL)
- Alert rules (YAML)
- Troubleshooting guides
- Emergency procedures
```

---

### RISK-004: Email Task Classification Confidence Threshold Missing
**Severity**: HIGH
**System**: Email Ingestion (`app/ingest/email_parser.py`)
**Recommendation**: REQUIRES_DECISION

**Gap Description**:
The spec shows email classification returning confidence scores (0.6-0.8) but doesn't define:
- Minimum confidence for automated task creation
- What happens at low confidence (human review? reject? ask sender?)
- Timeout for human review queue

**Impact**:
- Automated tasks created from misclassified emails
- Potential security exposure (blocked actions bypassed)
- User frustration from false task creation

**Required Decision**:
```
Define email task automation thresholds:
- AUTO_CREATE_THRESHOLD: [0.8? 0.9?] - create task automatically
- HUMAN_REVIEW_THRESHOLD: [0.5-0.8?] - queue for human review
- REJECT_THRESHOLD: [<0.5?] - do not create task, notify sender
- REVIEW_TIMEOUT_HOURS: [24? 48?] - auto-reject after timeout
```

**Blocked Items**: Email ingestion implementation

---

### RISK-005: Presentation Builder Not Implemented
**Severity**: MEDIUM
**System**: Presentation (`app/presentation/`)
**Recommendation**: FEATURE_FLAG

**Gap Description**:
The spec defines comprehensive presentation narrative structure but implementation is TODO:
- `app/presentation/narrative_builder.py` - not created
- `app/presentation/visual_validator.py` - not created

**Impact**:
- Cannot generate structured presentations
- Research results lack narrative coherence
- No chart validation (bad visualizations reach users)

**Action Plan**:
```python
# Implement behind feature flag
SWISSBRAIN_FEATURES = {
    "presentation_builder": False,  # Enable after testing
    "visual_validator": False,
}

# Phase 1: Visual Validator (standalone, no dependencies)
# Phase 2: Narrative Builder (depends on confidence scoring)
```

---

### RISK-006: Collaboration Conflict Resolver Not Implemented
**Severity**: MEDIUM
**System**: Collaboration (`app/collaboration/conflict_resolver.py`)
**Recommendation**: IMPLEMENT_NOW

**Gap Description**:
The spec defines clear conflict resolution rules but implementation is TODO. This is critical for real-time collaboration features.

**Impact**:
- Data loss when human and AI edit concurrently
- User frustration from unexpected content changes
- Potential legal issues if contracts/important docs are affected

**Action Plan**:
```
Implement per spec Section 5:
1. Rule 1: Human deletions are intentional → accept
2. Rule 2: AI deletions need confirmation → prompt user
3. Rule 3: Concurrent edits → merge if additive, else human wins
4. Rule 4: Style conflicts → AI yields
5. Rule 5: Structural conflicts → ask user
6. Default: Human wins

Estimated LOC: ~200
Tests required: ~25
```

---

### RISK-007: Missing Prometheus Metrics Instrumentation
**Severity**: MEDIUM
**System**: All Systems
**Recommendation**: IMPLEMENT_NOW

**Gap Description**:
While runbooks reference Prometheus metrics, actual instrumentation is incomplete:
- Plan Scoring: metrics defined in runbook but not verified in code
- Confidence Scoring: no metrics
- Research: no metrics
- Prompt Management: partial metrics

**Impact**:
- Alerts won't fire (no data to alert on)
- SLO tracking impossible
- Blind to performance degradation

**Action Plan**:
```python
# Required metrics per system:

# Plan Scoring
plan_scoring_total{decision}  # Counter
plan_scoring_duration_ms      # Histogram
plan_scoring_composite_score  # Gauge
repair_attempt_total          # Counter

# Confidence Scoring
confidence_score_distribution  # Histogram
hedging_level_total{level}    # Counter

# Research
research_job_total{status}    # Counter
research_duration_ms          # Histogram
research_sources_fetched      # Counter
research_facts_extracted      # Counter

# Prompt Management
prompt_execution_total{prompt_id,version,success}  # Counter
prompt_latency_ms{prompt_id}                       # Histogram
ab_test_assignment_total{test_id,variant}          # Counter
```

---

### RISK-008: Phase 8 Features Lack Database Persistence
**Severity**: MEDIUM
**System**: Advanced Features (`app/scheduler/`, `app/browser/`)
**Recommendation**: FEATURE_FLAG

**Gap Description**:
Task Scheduler and Browser Sessions use in-memory storage. Server restart loses:
- All scheduled tasks and their execution history
- All browser sessions and navigation history
- Pending task executions

**Impact**:
- Scheduled tasks don't survive deployment
- Browser sessions lost during scaling
- Unreliable for production use

**Action Plan**:
```sql
-- Required tables (migration needed)

CREATE TABLE scheduled_tasks (
    id UUID PRIMARY KEY,
    task_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    task_config JSONB,
    status TEXT DEFAULT 'active',
    last_executed_at TIMESTAMP,
    next_execution_at TIMESTAMP,
    execution_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE browser_sessions (
    id UUID PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active',
    current_url TEXT,
    history JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW()
);

-- Gate behind feature flag until migration tested
```

---

### RISK-009: Retry Semantics for Plan Repair Undefined
**Severity**: HIGH
**System**: Plan Scoring (`app/agent/plan_scorer.py`)
**Recommendation**: REQUIRES_DECISION

**Gap Description**:
The spec defines MAX_REPAIR_ATTEMPTS=3 but not:
- Delay between repair attempts
- Whether to use exponential backoff
- What happens if repair is interrupted by timeout
- Whether to return partial results

**Impact**:
- Thundering herd on LLM API during repair loops
- Unpredictable behavior at timeout boundaries
- No partial results for near-successful repairs

**Required Decision**:
```
Define repair retry semantics:
- REPAIR_DELAY_MS: [0? 1000? exponential?]
- TIMEOUT_BEHAVIOR: [abort? return_best? extend_if_improving?]
- PARTIAL_RESULTS: [enabled/disabled]
- REPAIR_STRATEGY: [sequential? parallel_variants?]
```

---

### RISK-010: Enterprise Policy Guards Not Implemented
**Severity**: LOW
**System**: All Systems
**Recommendation**: FEATURE_FLAG

**Gap Description**:
The HARD RULES require `NOT_IMPLEMENTED_ENTERPRISE_GAP` guards but these are not systematically implemented. Current differentiator modules (training, visitors, shifts, inventory) lack:
- RBAC integration
- Audit logging
- Data retention policies
- Compliance checks

**Impact**:
- Enterprise customers cannot adopt differentiator features
- Compliance violations possible
- Audit failures

**Action Plan**:
```python
# Decorator pattern for enterprise guards
def enterprise_guard(feature: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not ENTERPRISE_FEATURES.get(feature, False):
                raise NotImplementedEnterpriseGapError(
                    feature=feature,
                    message=f"{feature} requires enterprise license"
                )
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Apply to all differentiator endpoints
@enterprise_guard("training_management")
async def create_course(...):
    ...
```

---

### RISK-011: Slide Generation System Not Implemented (NEW)
**Severity**: MEDIUM
**System**: Slide Generation (`app/slides/`)
**Recommendation**: FEATURE_FLAG

**Gap Description**:
Complete slide generation spec added (`docs/specs/SLIDE_GENERATION_SPEC.md`) but no implementation exists:
- HTML mode with Chart.js integration
- Image mode (Nano Banana) with 15 style templates
- Content validation with word count constraints
- Image generation pipeline with text overlays
- Style-specific color palettes, fonts, and prompts

**Impact**:
- Cannot generate presentation slides from content
- Missing key Manus.im parity feature
- No automated presentation workflow

**Action Plan**:
```
Phase 1 - Foundation (IMPLEMENT_NOW):
├── app/slides/__init__.py
├── app/slides/content_validator.py (~100 LOC)
├── app/slides/slide_types.py (~50 LOC)
└── tests/slides/test_content_validator.py

Phase 2 - HTML Mode (FEATURE_FLAG):
├── app/slides/html_renderer.py (~300 LOC)
├── app/slides/chart_integration.py (~150 LOC)
└── tests/slides/test_html_renderer.py

Phase 3 - Image Mode (FEATURE_FLAG):
├── app/slides/image_pipeline.py (~250 LOC)
├── app/slides/text_renderer.py (~200 LOC)
├── app/slides/compositor.py (~150 LOC)
└── app/slides/styles/ (15 style configs)

Estimated Total: ~1200 LOC + tests
```

**Dependencies**:
- AI image generation service (Stable Diffusion/DALL-E)
- Chart.js CDN or bundled
- Google Fonts CDN

---

## Risk Summary Matrix

| Risk ID | Severity | System | Recommendation | Effort |
|---------|----------|--------|----------------|--------|
| RISK-001 | CRITICAL | Confidence | REQUIRES_DECISION | - |
| RISK-002 | HIGH | Prompts | REQUIRES_DECISION | - |
| RISK-003 | HIGH | Operations | IMPLEMENT_NOW | 2-3 days |
| RISK-004 | HIGH | Email | REQUIRES_DECISION | - |
| RISK-005 | MEDIUM | Presentation | FEATURE_FLAG | 3-4 days |
| RISK-006 | MEDIUM | Collaboration | IMPLEMENT_NOW | 1-2 days |
| RISK-007 | MEDIUM | All | IMPLEMENT_NOW | 2-3 days |
| RISK-008 | MEDIUM | Phase 8 | FEATURE_FLAG | 1-2 days |
| RISK-009 | HIGH | Plan Scoring | REQUIRES_DECISION | - |
| RISK-010 | LOW | Enterprise | FEATURE_FLAG | 3-4 days |
| RISK-011 | MEDIUM | Slides | FEATURE_FLAG | 5-7 days |

---

## Recommended Prioritization

### Immediate (Blocks Production)
1. **Resolve RISK-001** - Confidence calculation formula
2. **Resolve RISK-009** - Retry semantics for plan repair
3. **Implement RISK-003** - Create missing runbooks

### This Sprint
4. **Implement RISK-007** - Prometheus metrics instrumentation
5. **Implement RISK-006** - Collaboration conflict resolver
6. **Resolve RISK-002** - A/B test statistical significance

### Next Sprint
7. **Implement RISK-005** - Presentation builder (behind flag)
8. **Implement RISK-008** - Database persistence for Phase 8
9. **Resolve RISK-004** - Email classification thresholds

### Backlog
10. **Implement RISK-010** - Enterprise policy guards

---

## Decision Request Template

For REQUIRES_DECISION items, submit decisions in this format:

```markdown
## Decision: [RISK-ID] [Short Title]

**Date**: YYYY-MM-DD
**Decided By**: [Name/Role]

**Decision**:
[Clear statement of the chosen approach]

**Rationale**:
[Why this approach was chosen]

**Accepted Trade-offs**:
[What we're giving up with this decision]

**Implementation Notes**:
[Any specific implementation guidance]
```

---

**Risk Assessment Version**: 1.1.0
**Last Updated**: 2026-01-18
**Next Review**: After resolving REQUIRES_DECISION items
