# SwissBrain Intelligence Stack - Implementation Guide

**Source**: Adapted from Manus Intelligence Stack patterns
**Platform**: SwissBrain AI Platform
**Date**: January 15, 2026

---

## Overview

The intelligence stack defines **decision boundaries** - knowing when to explore vs. exploit, when to ask vs. assume, when to retry vs. abort, and when to show confidence vs. uncertainty.

**Core Philosophy**: The magic is not in the infrastructure. It's in the decision boundaries.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SWISSBRAIN INTELLIGENCE STACK                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   PLANNER   │───▶│  RESEARCH   │───▶│  SYNTHESIS  │───▶│   OUTPUT    │  │
│  │             │    │             │    │             │    │             │  │
│  │ • Score     │    │ • Decompose │    │ • Narrative │    │ • Confidence│  │
│  │ • Repair    │    │ • Parallel  │    │ • Visualize │    │ • Language  │  │
│  │ • Abort     │    │ • Prune     │    │ • Reject    │    │ • UI cues   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                   │                  │                  │          │
│         └───────────────────┴──────────────────┴──────────────────┘          │
│                                     │                                        │
│                              ┌──────▼──────┐                                │
│                              │   COLLAB    │                                │
│                              │  • Conflict │                                │
│                              │  • Merge    │                                │
│                              │  • Human ✓  │                                │
│                              └─────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Planner Agent (Phase 7 Integrated)

### Implementation Status: ✅ COMPLETE

**Files**:
- `app/research/job_manager.py` - Job lifecycle management
- `app/research/coordinator.py` - Parallel execution
- `app/research/synthesizer.py` - Result aggregation

### Decision Boundaries

#### 1.1 Plan Scoring Thresholds

```python
PLAN_THRESHOLDS = {
    'ACCEPT': 0.7,          # Good enough to execute
    'REPAIR': 0.4,          # Salvageable with fixes
    'REGENERATE': 0.4,      # Below this, start over
    'MAX_REPAIRS': 3,       # Stop repairing after this
    'FEASIBILITY_ZERO': 0,  # Impossible plan, regenerate immediately
}
```

#### 1.2 Abort Conditions

```python
PLANNER_ABORT_THRESHOLDS = {
    # Time limits
    'MAX_PLANNING_TIME_MS': 30000,          # 30s to produce plan
    'MAX_REPAIR_TIME_MS': 60000,            # 60s total for repairs
    'MAX_SINGLE_REPAIR_MS': 15000,          # 15s per repair attempt

    # Attempt limits
    'MAX_REPAIR_ATTEMPTS': 3,
    'MAX_REGENERATION_ATTEMPTS': 2,

    # Score thresholds
    'MIN_ACCEPTABLE_SCORE': 0.5,            # Don't even try below this
    'TARGET_SCORE': 0.7,                    # Stop repairing once reached

    # Complexity limits
    'MAX_PHASES': 15,
    'MAX_PHASE_DURATION_MS': 600000,        # 10 minutes per phase
    'MAX_TOTAL_DURATION_MS': 3600000        # 1 hour total
}
```

### Next: Implement Plan Scoring

**File to create**: `app/agent/plan_scorer.py`

```python
class PlanScore:
    feasibility: float      # 0-1: Can we do this?
    completeness: float     # 0-1: Does this cover the goal?
    efficiency: float       # 0-1: Shortest path?
    risk_adjusted: float    # Feasibility * (1 - risk_penalty)
    composite: float        # Weighted combination

def score_plan(plan, context):
    # Feasibility: Can each phase be executed?
    feasibility = calculate_feasibility(plan, context)

    # Completeness: Does execution achieve goal?
    completeness = measure_goal_coverage(plan.goal, plan.phases)

    # Efficiency: Penalize unnecessary phases
    efficiency = 1.0 - (count_redundant_phases(plan) / len(plan.phases))

    # Risk adjustment
    avg_risk = calculate_average_risk(plan.phases)
    risk_adjusted = feasibility * (1 - avg_risk * 0.3)

    # Composite score (weights tunable)
    composite = (
        feasibility * 0.35 +
        completeness * 0.35 +
        efficiency * 0.15 +
        risk_adjusted * 0.15
    )

    return PlanScore(feasibility, completeness, efficiency, risk_adjusted, composite)
```

---

## 2. Wide Research Orchestration (Phase 7 Integrated)

### Implementation Status: ✅ COMPLETE

**Files**:
- `app/research/coordinator.py` - Parallel task distribution
- `app/research/synthesizer.py` - Result combination

### Decision Boundaries

#### 2.1 Research Depth Time Budgets

```python
DEPTH_TIME_BUDGETS = {
    'shallow': 15000,   # 15 seconds
    'medium': 45000,    # 45 seconds
    'deep': 120000      # 2 minutes
}
```

#### 2.2 Diminishing Returns Detection

```python
def should_abort_research(progress):
    # RULE 1: No new facts in 30 seconds
    time_since_new_fact = progress.time_elapsed_ms - progress.last_new_fact_at_ms
    if time_since_new_fact > 30000:
        return True

    # RULE 2: Fact density too low
    fact_rate = progress.unique_facts / (progress.time_elapsed_ms / 1000)
    if progress.time_elapsed_ms > 30000 and fact_rate < 0.1:
        return True  # Less than 1 fact per 10 seconds

    # RULE 3: Source saturation
    if progress.sources_found > 20:
        return True

    return False
```

#### 2.3 Abort Thresholds

```python
RESEARCH_ABORT_THRESHOLDS = {
    # Per-task limits
    'MAX_TASK_TIME_MS': 120000,             # 2 minutes per task
    'MAX_SOURCES_PER_TASK': 15,
    'MAX_CONTENT_FETCH_FAILURES': 3,

    # Overall limits
    'MAX_TOTAL_RESEARCH_TIME_MS': 300000,   # 5 minutes total
    'MAX_PARALLEL_TASKS': 10,

    # Quality thresholds
    'MIN_SOURCE_QUALITY': 0.3,              # Don't read below this
    'MIN_RELEVANCE_FOR_SYNTHESIS': 0.5,

    # Diminishing returns
    'NO_NEW_FACTS_TIMEOUT_MS': 30000,       # 30s without new info
    'MIN_FACT_RATE': 0.1                    # Facts per second
}
```

### Next: Enhance Synthesizer

**File to enhance**: `app/research/synthesizer.py`

Add source quality scoring:

```python
def score_source(source, query):
    # Relevance: Semantic similarity
    relevance = compute_semantic_similarity(query, source.snippet)

    # Freshness: Prefer recent
    freshness = compute_freshness_score(source)

    # Authority: Domain reputation
    authority = DOMAIN_AUTHORITY_SCORES.get(extract_domain(source.url), 0.5)

    # Content depth
    depth = min(1, len(source.full_content) / 5000) if source.full_content else 0.3

    # Weighted combination (tunable)
    return (
        relevance * 0.4 +
        authority * 0.25 +
        depth * 0.2 +
        freshness * 0.15
    )
```

---

## 3. Presentation Narrative Construction

### Implementation Status: 🔄 TO IMPLEMENT

**Files to create**:
- `app/presentation/narrative_builder.py`
- `app/presentation/visual_selector.py`

### Decision Boundaries

#### 3.1 Narrative Structure

```python
class PresentationNarrative:
    hook: NarrativeElement              # First 30s: Why care?
    context: NarrativeElement           # Background needed
    tension: NarrativeElement           # Problem/opportunity
    journey: List[NarrativeElement]     # Exploration (3-5 beats)
    resolution: NarrativeElement        # Answer/recommendation
    call_to_action: NarrativeElement    # What to do next

class NarrativeElement:
    type: str                           # hook/context/tension/journey/resolution/cta
    content: str
    supporting_data: List[DataPoint]
    visual_suggestion: str
    estimated_duration_seconds: int
    emotional_tone: str                 # neutral/urgent/optimistic/cautionary
```

#### 3.2 Slide Count Heuristics

```python
def calculate_slide_count(duration_minutes):
    # RULE: 1-2 minutes per slide
    return {
        'min': duration_minutes // 2,
        'max': ceil(duration_minutes * 1.5),
        'target': duration_minutes  # 1 slide per minute ideal
    }

# Example:
# 10-minute presentation → 5-15 slides, target 10
# 30-minute presentation → 15-45 slides, target 30
```

---

## 4. Data Visualization Rejection Rules

### Implementation Status: 🔄 TO IMPLEMENT

**File to create**: `app/presentation/visual_validator.py`

### Decision Boundaries

#### 4.1 Rejection Rules

```python
def should_reject_visualization(request):
    # RULE 1: Not enough data
    if len(request.data) < 2:
        return True, "Use single stat instead"

    # RULE 2: Too many categories for pie
    if request.chart_type == 'pie' and len(request.data) > 7:
        return True, "Use bar chart or group into 'Other'"

    # RULE 3: Pie for non-part-of-whole
    if request.chart_type == 'pie':
        sum_values = sum(d.value for d in request.data)
        if abs(sum_values - 100) > 1 and abs(sum_values - 1) > 0.01:
            return True, "Pie charts must show parts of whole"

    # RULE 4: Line for non-sequential
    if request.chart_type == 'line' and not has_sequential_x_axis(request.data):
        return True, "Line charts require sequential x-axis"

    # RULE 5: 3D charts (always reject)
    if '3d' in request.chart_type:
        return True, "3D charts distort perception"

    # RULE 6: Dual-axis (almost always reject)
    if request.chart_type == 'dual_axis':
        return True, "Dual-axis charts misleading"

    # RULE 7: Data variance too low
    variance = calculate_variance(request.data)
    mean = sum(d.value for d in request.data) / len(request.data)
    if variance / mean < 0.05:  # Coefficient of variation < 5%
        return True, "Data too similar to visualize"

    return False, None
```

---

## 5. Collaboration Conflict Resolution

### Implementation Status: 🔄 TO IMPLEMENT

**File to create**: `app/collaboration/conflict_resolver.py`

### Decision Boundaries

```python
def select_resolution_strategy(conflict):
    # RULE 1: Human deletions are intentional
    if conflict.human_change.type == 'delete':
        return 'accept_human', "Human explicitly deleted"

    # RULE 2: AI deletions need confirmation
    if conflict.ai_change.type == 'delete' and conflict.human_change.type == 'modify':
        return 'keep_both_ask_user', "AI wanted to remove human-modified content"

    # RULE 3: Concurrent edits to same line
    if conflict.type == 'concurrent_edit':
        if edits_are_additive(conflict.human_change, conflict.ai_change):
            return 'merge_both', "Both edits add information"
        else:
            return 'accept_human_show_ai_suggestion', "Conflicting edits"

    # RULE 4: Style conflicts → AI yields
    if conflict.type == 'style_conflict':
        return 'accept_human', "Style preference deferred to human"

    # RULE 5: Structural conflicts → Ask user
    if conflict.type == 'structural_conflict':
        return 'ask_user', "Document structure changed"

    # DEFAULT: Human wins
    return 'accept_human', "Default: human intent takes precedence"
```

---

## 6. Email Task Ingestion

### Implementation Status: 🔄 TO IMPLEMENT

**File to create**: `app/ingest/email_parser.py`

### Decision Boundaries

#### 6.1 Classification Signals

```python
def classify_email(email):
    signals = []

    # Signal: Imperative verbs in subject
    if re.match(r'^(create|make|build|generate|send|schedule|book)', email.subject, re.I):
        signals.append('imperative_subject')

    # Signal: Question marks
    if email.subject.count('?') + email.body.count('?') > 2:
        signals.append('question_heavy')

    # Signal: Deadline mentions
    if re.search(r'by (monday|tuesday|eod|cob|\\d{1,2}/\\d{1,2})', email.body, re.I):
        signals.append('has_deadline')

    # Decision
    if 'imperative_subject' in signals or 'has_deadline' in signals:
        return 'task_request', 0.8
    elif 'question_heavy' in signals:
        return 'question', 0.7
    else:
        return 'information', 0.6
```

#### 6.2 Security Rules

```python
EMAIL_SECURITY_RULES = {
    # Sender verification
    'REQUIRE_DKIM': True,
    'REQUIRE_SPF': True,
    'ALLOWED_DOMAINS': ['swissbrain.ai', 'trusted-partner.com'],

    # Rate limiting
    'MAX_TASKS_PER_HOUR': 10,
    'MAX_TASKS_PER_DAY': 50,

    # Content limits
    'MAX_BODY_LENGTH': 50000,
    'MAX_ATTACHMENTS': 10,
    'MAX_ATTACHMENT_SIZE_MB': 25,

    # Blocked actions
    'BLOCKED_ACTIONS_FROM_EMAIL': [
        'delete_account',
        'change_password',
        'export_all_data'
    ],

    # Confirmation requirements
    'ALWAYS_CONFIRM_ACTIONS': [
        'send_email',
        'publish',
        'payment',
        'booking',
        'share_externally'
    ]
}
```

---

## 7. Confidence Scoring & UI Transparency

### Implementation Status: 🔄 TO IMPLEMENT

**File to create**: `app/confidence/scorer.py`

### Decision Boundaries

#### 7.1 Confidence → Language Mapping

```python
def confidence_to_language(confidence):
    if confidence >= 0.9:
        return {
            'hedging': 'none',
            'verbs': ['is', 'shows', 'demonstrates', 'confirms'],
            'qualifiers': [],
            'example': 'The data shows a 15% increase.'
        }

    if confidence >= 0.7:
        return {
            'hedging': 'light',
            'verbs': ['indicates', 'suggests', 'points to'],
            'qualifiers': ['generally', 'typically'],
            'example': 'The data suggests a 15% increase.'
        }

    if confidence >= 0.5:
        return {
            'hedging': 'moderate',
            'verbs': ['may indicate', 'appears to show', 'seems to suggest'],
            'qualifiers': ['possibly', 'potentially'],
            'example': 'The data appears to show approximately a 15% increase.'
        }

    if confidence >= 0.3:
        return {
            'hedging': 'heavy',
            'verbs': ['might', 'could potentially', 'some sources suggest'],
            'qualifiers': ['uncertain', 'limited data suggests'],
            'example': 'Limited data suggests there might be around a 15% increase.'
        }

    return {
        'hedging': 'maximum',
        'verbs': ['is unclear', 'cannot be determined'],
        'qualifiers': ['highly uncertain', 'speculative', 'unverified'],
        'example': 'It is unclear whether there has been an increase.'
    }
```

#### 7.2 UI Display Rules

```python
def confidence_to_ui_display(confidence):
    # HIGH CONFIDENCE: No indicator
    if confidence >= 0.8:
        return {'show_indicator': False}

    # MEDIUM CONFIDENCE: Subtle indicator
    if confidence >= 0.5:
        return {
            'show_indicator': True,
            'indicator_type': 'subtle',
            'tooltip': 'Based on limited sources',
            'expandable': True
        }

    # LOW CONFIDENCE: Prominent warning
    return {
        'show_indicator': True,
        'indicator_type': 'prominent',
        'tooltip': 'Highly uncertain - verify before using',
        'expandable': True
    }
```

---

## Implementation Checklist

| Subsystem | Status | Priority | Files |
|-----------|--------|----------|-------|
| **Planner Scoring** | 🔄 TODO | HIGH | `app/agent/plan_scorer.py` |
| **Research Orchestration** | ✅ DONE | HIGH | Phase 7 complete |
| **Presentation Builder** | 🔄 TODO | MEDIUM | `app/presentation/narrative_builder.py` |
| **Visualization Validator** | 🔄 TODO | MEDIUM | `app/presentation/visual_validator.py` |
| **Conflict Resolution** | 🔄 TODO | LOW | `app/collaboration/conflict_resolver.py` |
| **Email Ingestion** | 🔄 TODO | LOW | `app/ingest/email_parser.py` |
| **Confidence Scoring** | 🔄 TODO | HIGH | `app/confidence/scorer.py` |

---

## Next Steps

### Phase 8: Planner Scoring System
Implement plan scoring, repair, and abort logic building on Phase 7 research infrastructure.

### Phase 9: Confidence & Transparency
Add confidence scoring and language hedging to all agent outputs.

### Phase 10: Presentation Generation
Build narrative construction and visualization validation.

---

**Intelligence Stack Integration**: In Progress
**Foundation**: Phase 7 ✅ Complete
**Ready for**: Advanced decision boundaries implementation
