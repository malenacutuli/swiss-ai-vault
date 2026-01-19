# Runbook: Plan Scoring System

**Component**: `app/agent/plan_scorer.py`
**Spec Source**: `SWISSBRAIN_INTELLIGENCE_STACK.md` Section 1 (Planner Agent)
**Last Updated**: 2026-01-16

---

## Overview

The Plan Scoring System evaluates plans and decides whether to:
- **ACCEPT** (score >= 0.7): Execute the plan
- **REPAIR** (score 0.4-0.7): Attempt to fix the plan
- **REGENERATE** (score < 0.4): Start over with a new plan
- **ABORT**: Give up after exceeding limits

---

## Key Thresholds

| Threshold | Value | Description |
|-----------|-------|-------------|
| `ACCEPT` | 0.7 | Minimum score to execute |
| `REPAIR` | 0.4 | Minimum score to attempt repair |
| `MAX_PLANNING_TIME_MS` | 30,000 | 30s max planning time |
| `MAX_REPAIR_TIME_MS` | 60,000 | 60s total repair time |
| `MAX_REPAIR_ATTEMPTS` | 3 | Max repair cycles |
| `MAX_REGENERATION_ATTEMPTS` | 2 | Max plan regenerations |

---

## Monitoring

### Key Metrics

```promql
# Plan acceptance rate
sum(rate(plan_scoring_total{decision="accept"}[5m]))
/ sum(rate(plan_scoring_total[5m]))

# Average composite score
avg(plan_scoring_composite_score)

# Repair attempt rate
sum(rate(repair_attempt_total[5m]))

# Abort rate
sum(rate(plan_scoring_total{decision="abort"}[5m]))
/ sum(rate(plan_scoring_total[5m]))
```

### Alert Rules

```yaml
# Alert: High abort rate
- alert: PlanScoringHighAbortRate
  expr: |
    sum(rate(plan_scoring_total{decision="abort"}[5m]))
    / sum(rate(plan_scoring_total[5m])) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High plan abort rate (>10%)"
    runbook_url: "docs/runbooks/PLAN_SCORING.md#high-abort-rate"

# Alert: Low acceptance rate
- alert: PlanScoringLowAcceptRate
  expr: |
    sum(rate(plan_scoring_total{decision="accept"}[5m]))
    / sum(rate(plan_scoring_total[5m])) < 0.5
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Low plan acceptance rate (<50%)"

# Alert: Scoring latency
- alert: PlanScoringHighLatency
  expr: histogram_quantile(0.95, rate(plan_scoring_duration_ms_bucket[5m])) > 1000
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Plan scoring p95 latency > 1s"
```

---

## Troubleshooting

### High Abort Rate

**Symptoms:**
- `PlanScoringHighAbortRate` alert firing
- Users seeing "planning failed" errors

**Diagnosis:**
```bash
# Check abort reasons
kubectl logs -n agents deployment/agent-api | grep "abort_reason"

# Check session repair counts
kubectl logs -n agents deployment/agent-api | grep "repair_attempt" | tail -50
```

**Common Causes:**
1. **Max repair attempts exceeded**: Plans consistently scoring below 0.7 after 3 repairs
   - Check if goal complexity increased
   - Review available tools vs required tools

2. **Time limits exceeded**: Planning taking too long
   - Check LLM response times
   - Consider increasing `MAX_PLANNING_TIME_MS` if justified

3. **Max regenerations**: Plans fundamentally unsolvable
   - Check for impossible goals
   - Review user prompt quality

**Resolution:**
1. Review recent failed plans in logs
2. Identify common failure patterns
3. Adjust thresholds if business requirements changed
4. Consider prompt improvements for plan generation

---

### Low Acceptance Rate

**Symptoms:**
- Most plans require repair cycles
- Increased latency due to repair loops

**Diagnosis:**
```bash
# Check score distribution
kubectl logs -n agents deployment/agent-api | grep "composite_score" | awk '{print $NF}' | sort -n
```

**Common Causes:**
1. **Missing tools**: Required tools not available
   - Check `ScoringContext.available_tools`

2. **Poor goal coverage**: Generated plans don't match goals
   - Review plan generation prompts

3. **High risk phases**: Too many high-risk operations
   - Consider phase splitting

**Resolution:**
1. Ensure tool registry is complete
2. Review and improve plan generation
3. Add repair suggestions for common issues

---

### Scoring Latency Spikes

**Symptoms:**
- `PlanScoringHighLatency` alert
- Slow planning responses

**Diagnosis:**
```bash
# Check scoring durations
kubectl logs -n agents deployment/agent-api | grep "scoring_duration_ms"
```

**Common Causes:**
1. **Large plans**: Many phases to evaluate
2. **Complex dependency graphs**: Expensive feasibility checks
3. **Memory pressure**: GC pauses

**Resolution:**
1. Add phase count limits
2. Optimize dependency checking
3. Scale resources if needed

---

## Operations

### Manually Override Thresholds (Emergency)

```python
# In Python REPL or script
from app.agent.plan_scorer import PLAN_THRESHOLDS

# Lower acceptance threshold (use sparingly)
PLAN_THRESHOLDS["ACCEPT"] = 0.6

# Increase repair attempts
PLAN_THRESHOLDS["MAX_REPAIRS"] = 5
```

**WARNING**: Only for emergencies. Restore defaults and file issue.

### Clear Stuck Sessions

```python
from app.agent.plan_scorer import get_plan_scorer

scorer = get_plan_scorer()

# Clear specific session
scorer.clear_session("stuck-session-id")

# Or reset entire scorer
from app.agent.plan_scorer import reset_plan_scorer
reset_plan_scorer()
```

### Test Scoring Locally

```python
from app.agent.plan_scorer import Plan, PlanPhase, PlanScorer, ScoringContext

# Create test plan
plan = Plan(
    id="test-1",
    goal="Research and report",
    phases=[
        PlanPhase(id="p1", name="Research", description="Research topic"),
        PlanPhase(id="p2", name="Report", description="Write report"),
    ],
)

# Score it
scorer = PlanScorer()
result = scorer.score(plan, ScoringContext())

print(f"Score: {result.score.composite}")
print(f"Decision: {result.decision.value}")
```

---

## Rollback Procedure

If plan scoring causes issues:

1. **Disable plan scoring** (use bypass):
```python
# Bypass scoring, always accept
result = ScoringResult(
    plan_id=plan.id,
    score=PlanScore(1, 1, 1, 1, 1),
    decision=PlanDecision.ACCEPT,
)
```

2. **Roll back deployment**:
```bash
kubectl rollout undo deployment/agent-api -n agents
```

3. **Investigate**:
   - Check logs for scoring failures
   - Review recent changes to scoring logic

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-16 | 1.0.0 | Initial implementation per spec |

---

## References

- Spec: `SWISSBRAIN_INTELLIGENCE_STACK.md` Section 1
- Tests: `tests/agent/test_plan_scorer.py`
- Code: `app/agent/plan_scorer.py`
