# Manus Intelligence Implementation Guide

**Document Type:** Implementation-Ready Technical Guide  
**Author:** Technical Lead, Manus.im  
**Target Audience:** Engineers rebuilding Manus with Claude Code  
**Prerequisite:** Enterprise infra (state machines, billing, sandboxing) already in place

---

## Preface: What Makes Manus Feel "Magical"

The magic is not in the infrastructure. It's in the **decision boundaries** — knowing when to explore vs. exploit, when to ask vs. assume, when to retry vs. abort, and when to show confidence vs. uncertainty. This guide documents those boundaries with implementation-ready specificity.

---

## 1. Planner Agent: Scoring and Repair Logic

### 1.1 Core Philosophy

The planner is not a one-shot generator. It's a **living document** that gets scored, repaired, and re-scored until it crosses a viability threshold or exhausts repair attempts.

### 1.2 Plan Structure

```typescript
interface Plan {
  id: string;
  goal: string;                    // User's intent, normalized
  phases: Phase[];
  score: PlanScore;
  repair_history: RepairAttempt[];
  created_at: number;
  version: number;
}

interface Phase {
  id: number;
  title: string;
  capabilities: Capability[];      // What tools/skills this phase needs
  estimated_duration_ms: number;
  dependencies: number[];          // Phase IDs this depends on
  risk_level: 'low' | 'medium' | 'high';
  abort_conditions: AbortCondition[];
}

interface PlanScore {
  feasibility: number;             // 0-1: Can we actually do this?
  completeness: number;            // 0-1: Does this cover the goal?
  efficiency: number;              // 0-1: Is this the shortest path?
  risk_adjusted: number;           // 0-1: Feasibility * (1 - risk_penalty)
  composite: number;               // Weighted combination
}
```

### 1.3 Plan Scoring Algorithm

```typescript
function scorePlan(plan: Plan, context: ExecutionContext): PlanScore {
  // FEASIBILITY: Can each phase actually be executed?
  const feasibility = plan.phases.reduce((acc, phase) => {
    const capabilityScore = phase.capabilities.every(cap => 
      context.available_capabilities.includes(cap)
    ) ? 1.0 : 0.0;
    
    const resourceScore = estimateResourceAvailability(phase, context);
    const dependencyScore = validateDependencies(phase, plan.phases);
    
    return acc * (capabilityScore * 0.4 + resourceScore * 0.3 + dependencyScore * 0.3);
  }, 1.0);

  // COMPLETENESS: Does executing all phases achieve the goal?
  const completeness = measureGoalCoverage(plan.goal, plan.phases);
  
  // EFFICIENCY: Penalize unnecessary phases
  const efficiency = 1.0 - (countRedundantPhases(plan) / plan.phases.length);
  
  // RISK ADJUSTMENT
  const avgRisk = plan.phases.reduce((acc, p) => 
    acc + RISK_WEIGHTS[p.risk_level], 0
  ) / plan.phases.length;
  const risk_adjusted = feasibility * (1 - avgRisk * 0.3);

  // COMPOSITE SCORE
  // These weights are INTENTIONALLY PRODUCT-DRIVEN
  // Adjust based on user feedback patterns
  const composite = 
    feasibility * 0.35 +
    completeness * 0.35 +
    efficiency * 0.15 +
    risk_adjusted * 0.15;

  return { feasibility, completeness, efficiency, risk_adjusted, composite };
}

const RISK_WEIGHTS = {
  low: 0.1,
  medium: 0.3,
  high: 0.6
};
```

### 1.4 Plan Repair Logic

**When to repair vs. regenerate:**

| Condition | Action | Rationale |
|-----------|--------|-----------|
| `composite >= 0.7` | Accept | Good enough to execute |
| `composite >= 0.4 && repair_attempts < 3` | Repair | Salvageable |
| `composite < 0.4 \|\| repair_attempts >= 3` | Regenerate | Fundamentally broken |
| `feasibility == 0` | Regenerate immediately | Impossible plan |

```typescript
async function repairPlan(
  plan: Plan, 
  score: PlanScore,
  context: ExecutionContext
): Promise<Plan> {
  const issues = diagnoseIssues(plan, score);
  
  // REPAIR STRATEGIES (ordered by invasiveness)
  const strategies: RepairStrategy[] = [
    // 1. Parameter adjustment (least invasive)
    {
      applies: issues.includes('resource_mismatch'),
      repair: () => adjustPhaseResources(plan, context)
    },
    // 2. Phase reordering
    {
      applies: issues.includes('dependency_violation'),
      repair: () => reorderPhases(plan)
    },
    // 3. Phase splitting
    {
      applies: issues.includes('phase_too_complex'),
      repair: () => splitComplexPhases(plan)
    },
    // 4. Phase removal
    {
      applies: issues.includes('redundant_phases'),
      repair: () => removeRedundantPhases(plan)
    },
    // 5. Phase insertion (most invasive)
    {
      applies: issues.includes('missing_capability'),
      repair: () => insertMissingPhases(plan, context)
    }
  ];

  let repairedPlan = plan;
  for (const strategy of strategies) {
    if (strategy.applies) {
      repairedPlan = await strategy.repair();
      // Re-score after each repair
      const newScore = scorePlan(repairedPlan, context);
      if (newScore.composite >= 0.7) {
        return repairedPlan; // Early exit on success
      }
    }
  }

  return repairedPlan;
}

function diagnoseIssues(plan: Plan, score: PlanScore): string[] {
  const issues: string[] = [];
  
  if (score.feasibility < 0.5) {
    // Drill down to find WHY
    for (const phase of plan.phases) {
      if (!hasRequiredCapabilities(phase)) {
        issues.push('missing_capability');
      }
      if (estimateResourceAvailability(phase) < 0.5) {
        issues.push('resource_mismatch');
      }
    }
  }
  
  if (score.completeness < 0.7) {
    const uncoveredGoals = findUncoveredGoalAspects(plan);
    if (uncoveredGoals.length > 0) {
      issues.push('incomplete_coverage');
    }
  }
  
  if (score.efficiency < 0.6) {
    issues.push('redundant_phases');
  }
  
  // Check for phases that are too ambitious
  for (const phase of plan.phases) {
    if (phase.estimated_duration_ms > 600000) { // 10 minutes
      issues.push('phase_too_complex');
    }
  }
  
  return [...new Set(issues)]; // Dedupe
}
```

### 1.5 Goal Coverage Measurement

This is where the "magic" happens. We use semantic similarity, not string matching.

```typescript
async function measureGoalCoverage(
  goal: string, 
  phases: Phase[]
): Promise<number> {
  // Extract goal aspects using LLM
  const goalAspects = await extractGoalAspects(goal);
  // Example: "Create a quarterly report with charts"
  // → ["create document", "quarterly data", "include charts", "report format"]
  
  // For each aspect, check if any phase addresses it
  const coverageScores = await Promise.all(
    goalAspects.map(async (aspect) => {
      const phaseDescriptions = phases.map(p => p.title).join('\n');
      
      // Use embedding similarity, NOT exact match
      const similarity = await computeSemanticSimilarity(
        aspect,
        phaseDescriptions
      );
      
      return similarity;
    })
  );
  
  // Minimum coverage across all aspects
  // (One missing aspect tanks the whole score)
  const minCoverage = Math.min(...coverageScores);
  const avgCoverage = coverageScores.reduce((a, b) => a + b, 0) / coverageScores.length;
  
  // Weighted: 60% min, 40% avg
  // This prevents plans that nail 3/4 aspects but miss one entirely
  return minCoverage * 0.6 + avgCoverage * 0.4;
}
```

### 1.6 What NOT To Do (Failure Modes)

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Greedy phase generation** | LLM generates 15 phases for a simple task | Cap at `min(10, estimated_complexity * 2)` phases |
| **Ignoring user's implicit constraints** | User says "quick summary" but plan includes deep research | Extract tempo/depth signals from language |
| **Repairing forever** | Stuck in repair loop for 5+ minutes | Hard cap: 3 repairs, 60 seconds total |
| **Trusting LLM's self-assessment** | "This plan is perfect" → actually broken | Always validate with deterministic checks |
| **Monolithic phases** | "Phase 1: Do everything" | Split any phase > 5 min estimated duration |
| **Sequential when parallel is possible** | 10 independent searches done one-by-one | Detect independence, use `map` tool |

### 1.7 Abort Thresholds

```typescript
const PLANNER_ABORT_THRESHOLDS = {
  // Time limits
  MAX_PLANNING_TIME_MS: 30000,           // 30 seconds to produce a plan
  MAX_REPAIR_TIME_MS: 60000,             // 60 seconds total for repairs
  MAX_SINGLE_REPAIR_MS: 15000,           // 15 seconds per repair attempt
  
  // Attempt limits
  MAX_REPAIR_ATTEMPTS: 3,
  MAX_REGENERATION_ATTEMPTS: 2,
  
  // Score thresholds
  MIN_ACCEPTABLE_SCORE: 0.5,             // Below this, don't even try
  TARGET_SCORE: 0.7,                     // Stop repairing once reached
  
  // Complexity limits
  MAX_PHASES: 15,
  MAX_PHASE_DURATION_MS: 600000,         // 10 minutes per phase
  MAX_TOTAL_ESTIMATED_DURATION_MS: 3600000  // 1 hour total
};
```

---

## 2. Wide Research Orchestration

### 2.1 Core Philosophy

Wide research is **parallel exploration with intelligent pruning**. The goal is to cast a wide net, then aggressively filter to the highest-signal results.

### 2.2 Research Task Structure

```typescript
interface ResearchTask {
  id: string;
  query: string;
  query_variants: string[];           // 2-3 expansions of the same intent
  search_type: 'info' | 'news' | 'research' | 'data' | 'api';
  priority: number;                   // 1-10, affects resource allocation
  max_sources: number;
  depth: 'shallow' | 'medium' | 'deep';
  time_budget_ms: number;
  abort_conditions: AbortCondition[];
}

interface ResearchResult {
  task_id: string;
  sources: Source[];
  synthesis: string;
  confidence: number;
  coverage_gaps: string[];
  contradictions: Contradiction[];
}
```

### 2.3 Orchestration Algorithm

```typescript
async function orchestrateWideResearch(
  goal: string,
  context: ExecutionContext
): Promise<ResearchResult[]> {
  // PHASE 1: Query decomposition
  const tasks = await decomposeIntoResearchTasks(goal);
  
  // PHASE 2: Prioritization
  const prioritizedTasks = prioritizeTasks(tasks, context);
  
  // PHASE 3: Parallel execution with budget
  const results = await executeWithBudget(prioritizedTasks, {
    total_time_budget_ms: context.time_budget_ms * 0.6, // 60% for research
    max_concurrent: calculateMaxConcurrent(context),
    abort_on_diminishing_returns: true
  });
  
  // PHASE 4: Synthesis and gap analysis
  const synthesized = await synthesizeResults(results, goal);
  
  // PHASE 5: Decide if more research needed
  if (synthesized.coverage_gaps.length > 0 && context.depth !== 'shallow') {
    const followUpTasks = generateFollowUpTasks(synthesized.coverage_gaps);
    const followUpResults = await executeWithBudget(followUpTasks, {
      total_time_budget_ms: context.time_budget_ms * 0.2, // 20% for follow-up
      max_concurrent: 3
    });
    return [...results, ...followUpResults];
  }
  
  return results;
}
```

### 2.4 Query Decomposition

```typescript
async function decomposeIntoResearchTasks(goal: string): Promise<ResearchTask[]> {
  // Use LLM to identify distinct information needs
  const decomposition = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are a research strategist. Given a goal, identify 3-7 distinct 
                  information needs that must be satisfied. For each, specify:
                  - The core question
                  - 2-3 query variants (different phrasings)
                  - Search type (info/news/research/data/api)
                  - Depth needed (shallow/medium/deep)
                  
                  Output as JSON array.`
      },
      { role: 'user', content: goal }
    ],
    response_format: { type: 'json_object' }
  });
  
  const parsed = JSON.parse(decomposition.choices[0].message.content);
  
  // VALIDATION: Don't trust LLM blindly
  return parsed.tasks
    .filter(t => t.query && t.query.length > 5)
    .slice(0, 7) // Hard cap
    .map((t, i) => ({
      id: `research_${i}`,
      query: t.query,
      query_variants: (t.variants || []).slice(0, 3),
      search_type: VALID_SEARCH_TYPES.includes(t.search_type) ? t.search_type : 'info',
      priority: Math.min(10, Math.max(1, t.priority || 5)),
      max_sources: t.depth === 'deep' ? 10 : t.depth === 'medium' ? 5 : 3,
      depth: t.depth || 'medium',
      time_budget_ms: DEPTH_TIME_BUDGETS[t.depth || 'medium'],
      abort_conditions: []
    }));
}

const DEPTH_TIME_BUDGETS = {
  shallow: 15000,   // 15 seconds
  medium: 45000,    // 45 seconds
  deep: 120000      // 2 minutes
};
```

### 2.5 Diminishing Returns Detection

This is critical. Without it, research spirals forever.

```typescript
interface ResearchProgress {
  sources_found: number;
  unique_facts_extracted: number;
  time_elapsed_ms: number;
  last_new_fact_at_ms: number;
}

function shouldAbortResearch(progress: ResearchProgress): boolean {
  // RULE 1: No new facts in last 30 seconds
  const time_since_new_fact = progress.time_elapsed_ms - progress.last_new_fact_at_ms;
  if (time_since_new_fact > 30000) {
    return true;
  }
  
  // RULE 2: Fact density dropping below threshold
  const fact_rate = progress.unique_facts_extracted / (progress.time_elapsed_ms / 1000);
  if (progress.time_elapsed_ms > 30000 && fact_rate < 0.1) { // Less than 1 fact per 10 seconds
    return true;
  }
  
  // RULE 3: Source saturation
  if (progress.sources_found > 20) {
    return true; // Enough sources, time to synthesize
  }
  
  return false;
}
```

### 2.6 Source Quality Scoring

```typescript
interface Source {
  url: string;
  title: string;
  snippet: string;
  full_content?: string;
  quality_score: number;
  relevance_score: number;
  freshness_score: number;
  authority_score: number;
}

function scoreSource(source: Source, query: string): number {
  // RELEVANCE: Does this actually answer the query?
  const relevance = computeSemanticSimilarity(query, source.snippet);
  
  // FRESHNESS: Prefer recent for time-sensitive topics
  const freshness = computeFreshnessScore(source);
  
  // AUTHORITY: Domain reputation
  const authority = DOMAIN_AUTHORITY_SCORES[extractDomain(source.url)] || 0.5;
  
  // CONTENT DEPTH: Longer, structured content scores higher
  const depth = source.full_content 
    ? Math.min(1, source.full_content.length / 5000)
    : 0.3;
  
  // Weighted combination
  // INTENTIONALLY PRODUCT-DRIVEN: Adjust based on user feedback
  return (
    relevance * 0.4 +
    authority * 0.25 +
    depth * 0.2 +
    freshness * 0.15
  );
}

const DOMAIN_AUTHORITY_SCORES: Record<string, number> = {
  'wikipedia.org': 0.7,
  'github.com': 0.8,
  'arxiv.org': 0.9,
  'nature.com': 0.95,
  'gov': 0.85,          // .gov domains
  'edu': 0.8,           // .edu domains
  // ... extend based on domain
};
```

### 2.7 What NOT To Do (Failure Modes)

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Searching the same thing 5 ways** | Wastes time, same results | Max 3 query variants |
| **Reading every search result** | 90% are low-signal | Score first, read top 5 |
| **No deduplication** | Same fact from 10 sources | Hash facts, dedupe aggressively |
| **Trusting snippets** | Snippets are often misleading | Always fetch full content for top sources |
| **Ignoring contradictions** | Presents conflicting info as fact | Explicitly surface contradictions |
| **Research without time budget** | Runs for 10 minutes on simple query | Hard time cap per task |

### 2.8 Abort Thresholds

```typescript
const RESEARCH_ABORT_THRESHOLDS = {
  // Per-task limits
  MAX_TASK_TIME_MS: 120000,              // 2 minutes per research task
  MAX_SOURCES_PER_TASK: 15,
  MAX_CONTENT_FETCH_FAILURES: 3,         // Abort task after 3 failed fetches
  
  // Overall limits
  MAX_TOTAL_RESEARCH_TIME_MS: 300000,    // 5 minutes total
  MAX_PARALLEL_TASKS: 10,
  
  // Quality thresholds
  MIN_SOURCE_QUALITY: 0.3,               // Don't even read below this
  MIN_RELEVANCE_FOR_SYNTHESIS: 0.5,      // Don't include in synthesis
  
  // Diminishing returns
  NO_NEW_FACTS_TIMEOUT_MS: 30000,        // 30 seconds without new info
  MIN_FACT_RATE: 0.1                     // Facts per second
};
```

---

## 3. Presentation Narrative Construction

### 3.1 Core Philosophy

A presentation is not a document reformatted into slides. It's a **narrative arc** with emotional beats, designed for human attention spans.

### 3.2 Narrative Structure

```typescript
interface PresentationNarrative {
  hook: NarrativeElement;              // First 30 seconds: Why should I care?
  context: NarrativeElement;           // Background needed to understand
  tension: NarrativeElement;           // The problem/opportunity
  journey: NarrativeElement[];         // The exploration (3-5 beats)
  resolution: NarrativeElement;        // The answer/recommendation
  call_to_action: NarrativeElement;    // What should audience do next?
}

interface NarrativeElement {
  type: 'hook' | 'context' | 'tension' | 'journey' | 'resolution' | 'cta';
  content: string;
  supporting_data?: DataPoint[];
  visual_suggestion: VisualType;
  estimated_duration_seconds: number;
  emotional_tone: 'neutral' | 'urgent' | 'optimistic' | 'cautionary';
}

type VisualType = 
  | 'title_slide'
  | 'single_stat'
  | 'comparison_chart'
  | 'timeline'
  | 'process_flow'
  | 'image_with_caption'
  | 'quote'
  | 'bullet_points'  // Use sparingly!
  | 'data_table';
```

### 3.3 Narrative Construction Algorithm

```typescript
async function constructNarrative(
  content: ResearchResult[],
  audience: AudienceProfile,
  duration_minutes: number
): Promise<PresentationNarrative> {
  // STEP 1: Extract key insights
  const insights = await extractKeyInsights(content);
  
  // STEP 2: Identify the "so what"
  const core_message = await identifyCoreMessage(insights, audience);
  
  // STEP 3: Build narrative arc
  const narrative: PresentationNarrative = {
    hook: await constructHook(core_message, audience),
    context: await constructContext(insights, audience.knowledge_level),
    tension: await constructTension(insights),
    journey: await constructJourney(insights, duration_minutes),
    resolution: await constructResolution(core_message, insights),
    call_to_action: await constructCTA(core_message, audience)
  };
  
  // STEP 4: Validate pacing
  const total_duration = calculateTotalDuration(narrative);
  if (total_duration > duration_minutes * 60) {
    narrative.journey = pruneJourney(narrative.journey, duration_minutes);
  }
  
  // STEP 5: Assign visuals
  return assignVisuals(narrative);
}
```

### 3.4 Hook Construction

The hook is the most important slide. Get it wrong, lose the audience.

```typescript
async function constructHook(
  core_message: string,
  audience: AudienceProfile
): Promise<NarrativeElement> {
  // STRATEGY SELECTION based on content type
  const strategies = [
    {
      name: 'surprising_stat',
      applies: hasShockingStat(core_message),
      construct: () => buildStatHook(core_message)
    },
    {
      name: 'provocative_question',
      applies: true, // Always applicable
      construct: () => buildQuestionHook(core_message, audience)
    },
    {
      name: 'contrast',
      applies: hasBeforeAfter(core_message),
      construct: () => buildContrastHook(core_message)
    },
    {
      name: 'story',
      applies: audience.prefers_narrative,
      construct: () => buildStoryHook(core_message)
    }
  ];
  
  // Pick first applicable strategy
  // ORDER MATTERS: surprising_stat > question > contrast > story
  for (const strategy of strategies) {
    if (strategy.applies) {
      return strategy.construct();
    }
  }
  
  // Fallback: simple statement
  return {
    type: 'hook',
    content: core_message,
    visual_suggestion: 'title_slide',
    estimated_duration_seconds: 30,
    emotional_tone: 'neutral'
  };
}
```

### 3.5 Journey Beat Construction

```typescript
async function constructJourney(
  insights: Insight[],
  duration_minutes: number
): Promise<NarrativeElement[]> {
  // Calculate available time for journey (60% of total)
  const journey_seconds = duration_minutes * 60 * 0.6;
  const target_beats = Math.min(5, Math.max(3, Math.floor(journey_seconds / 60)));
  
  // Cluster insights into themes
  const themes = await clusterInsights(insights);
  
  // Select top themes by importance
  const selected_themes = themes
    .sort((a, b) => b.importance - a.importance)
    .slice(0, target_beats);
  
  // Build beat for each theme
  return selected_themes.map((theme, index) => ({
    type: 'journey' as const,
    content: theme.summary,
    supporting_data: theme.data_points.slice(0, 3),
    visual_suggestion: selectVisualForTheme(theme),
    estimated_duration_seconds: journey_seconds / target_beats,
    emotional_tone: determineEmotionalTone(theme, index, target_beats)
  }));
}

function determineEmotionalTone(
  theme: Theme,
  index: number,
  total_beats: number
): NarrativeElement['emotional_tone'] {
  // NARRATIVE ARC: Build tension, then release
  if (index < total_beats / 2) {
    // First half: Build tension
    return theme.is_problem ? 'urgent' : 'neutral';
  } else {
    // Second half: Move toward resolution
    return theme.is_solution ? 'optimistic' : 'neutral';
  }
}
```

### 3.6 What NOT To Do (Failure Modes)

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Wall of text slides** | Nobody reads them | Max 6 words per bullet, max 4 bullets |
| **Data dump** | Overwhelms audience | One insight per slide |
| **No narrative arc** | Feels like a list | Hook → Tension → Resolution |
| **Burying the lede** | Key insight on slide 15 | Core message in first 2 minutes |
| **Inconsistent visual style** | Looks unprofessional | Lock in style before content |
| **Too many slides** | Rushed delivery | 1-2 minutes per slide minimum |
| **Ending with Q&A slide** | Weak ending | End with call to action |

### 3.7 Slide Count Heuristics

```typescript
function calculateSlideCount(duration_minutes: number): { min: number; max: number; target: number } {
  // RULE: 1-2 minutes per slide for comfortable pacing
  return {
    min: Math.floor(duration_minutes / 2),
    max: Math.ceil(duration_minutes * 1.5),
    target: duration_minutes  // 1 slide per minute is ideal
  };
}

// Example:
// 10-minute presentation → 5-15 slides, target 10
// 30-minute presentation → 15-45 slides, target 30
```

---

## 4. Data → Visualization Rejection Rules

### 4.1 Core Philosophy

Not all data deserves a chart. Bad visualizations are worse than no visualization. **Reject aggressively.**

### 4.2 Rejection Decision Tree

```typescript
interface DataVisualizationRequest {
  data: any[];
  suggested_chart_type: ChartType;
  context: string;
  audience: AudienceProfile;
}

interface RejectionResult {
  rejected: boolean;
  reason?: string;
  suggestion?: string;
}

function shouldRejectVisualization(request: DataVisualizationRequest): RejectionResult {
  const { data, suggested_chart_type, context } = request;
  
  // RULE 1: Not enough data points
  if (data.length < 2) {
    return {
      rejected: true,
      reason: 'INSUFFICIENT_DATA',
      suggestion: 'Use a single stat callout instead of a chart'
    };
  }
  
  // RULE 2: Too many data points for chart type
  if (suggested_chart_type === 'pie' && data.length > 7) {
    return {
      rejected: true,
      reason: 'TOO_MANY_CATEGORIES',
      suggestion: 'Use bar chart or group into "Other" category'
    };
  }
  
  // RULE 3: Pie chart for non-part-of-whole data
  if (suggested_chart_type === 'pie') {
    const sum = data.reduce((acc, d) => acc + d.value, 0);
    const isPartOfWhole = Math.abs(sum - 100) < 1 || Math.abs(sum - 1) < 0.01;
    if (!isPartOfWhole) {
      return {
        rejected: true,
        reason: 'PIE_NOT_PART_OF_WHOLE',
        suggestion: 'Pie charts must show parts of a whole. Use bar chart instead.'
      };
    }
  }
  
  // RULE 4: Line chart for non-sequential data
  if (suggested_chart_type === 'line' && !hasSequentialXAxis(data)) {
    return {
      rejected: true,
      reason: 'LINE_NON_SEQUENTIAL',
      suggestion: 'Line charts require sequential x-axis (time, order). Use bar chart.'
    };
  }
  
  // RULE 5: 3D charts (always reject)
  if (suggested_chart_type.includes('3d')) {
    return {
      rejected: true,
      reason: '3D_CHART_REJECTED',
      suggestion: '3D charts distort perception. Use 2D equivalent.'
    };
  }
  
  // RULE 6: Dual-axis charts (almost always reject)
  if (suggested_chart_type === 'dual_axis') {
    return {
      rejected: true,
      reason: 'DUAL_AXIS_MISLEADING',
      suggestion: 'Dual-axis charts are easily manipulated. Use two separate charts.'
    };
  }
  
  // RULE 7: Data variance too low
  const variance = calculateVariance(data.map(d => d.value));
  const mean = data.reduce((acc, d) => acc + d.value, 0) / data.length;
  if (variance / mean < 0.05) { // Coefficient of variation < 5%
    return {
      rejected: true,
      reason: 'VARIANCE_TOO_LOW',
      suggestion: 'Data points are too similar to visualize meaningfully. State the average.'
    };
  }
  
  // RULE 8: Missing or invalid values
  const invalidCount = data.filter(d => d.value === null || d.value === undefined || isNaN(d.value)).length;
  if (invalidCount / data.length > 0.2) { // >20% invalid
    return {
      rejected: true,
      reason: 'TOO_MANY_INVALID_VALUES',
      suggestion: 'Clean data first or acknowledge gaps explicitly.'
    };
  }
  
  return { rejected: false };
}
```

### 4.3 Chart Type Selection Matrix

```typescript
function selectChartType(data: any[], intent: VisualizationIntent): ChartType {
  const matrix: Record<VisualizationIntent, (data: any[]) => ChartType> = {
    'comparison': (d) => d.length <= 10 ? 'bar' : 'horizontal_bar',
    'trend': (d) => hasTimeAxis(d) ? 'line' : 'bar',
    'distribution': (d) => d.length > 20 ? 'histogram' : 'bar',
    'composition': (d) => d.length <= 5 ? 'pie' : 'stacked_bar',
    'relationship': (d) => 'scatter',
    'ranking': (d) => 'horizontal_bar',
    'part_to_whole': (d) => d.length <= 5 ? 'pie' : 'treemap',
    'flow': (d) => 'sankey',
    'geographic': (d) => 'map'
  };
  
  return matrix[intent](data);
}

type VisualizationIntent = 
  | 'comparison'      // Compare values across categories
  | 'trend'           // Show change over time
  | 'distribution'    // Show spread of values
  | 'composition'     // Show parts of a whole
  | 'relationship'    // Show correlation between variables
  | 'ranking'         // Show ordered list
  | 'part_to_whole'   // Show proportions
  | 'flow'            // Show movement between states
  | 'geographic';     // Show location-based data
```

### 4.4 What NOT To Do (Failure Modes)

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Pie chart with 12 slices** | Unreadable | Bar chart or top 5 + "Other" |
| **Line chart for categories** | Implies false continuity | Bar chart |
| **Truncated Y-axis** | Exaggerates differences | Start Y-axis at 0 (usually) |
| **Rainbow color scheme** | Distracting, accessibility issues | 2-3 colors max, colorblind-safe |
| **Chart for 2 numbers** | Overkill | Simple text comparison |
| **Unlabeled axes** | Meaningless | Always label with units |
| **Gridlines everywhere** | Visual noise | Minimal or no gridlines |

---

## 5. Collaboration Conflict Resolution (Human vs. AI)

### 5.1 Core Philosophy

When human and AI edits conflict, **human intent wins, but AI should explain the tradeoff**. Never silently discard human work.

### 5.2 Conflict Types

```typescript
type ConflictType =
  | 'concurrent_edit'      // Both edited same region simultaneously
  | 'semantic_conflict'    // Edits are logically incompatible
  | 'style_conflict'       // Different formatting/style choices
  | 'deletion_conflict'    // One deleted what other modified
  | 'structural_conflict'; // Reorganization conflicts

interface Conflict {
  type: ConflictType;
  location: DocumentLocation;
  human_change: Change;
  ai_change: Change;
  detected_at: number;
  auto_resolvable: boolean;
  resolution_strategy?: ResolutionStrategy;
}
```

### 5.3 Resolution Strategy Selection

```typescript
function selectResolutionStrategy(conflict: Conflict): ResolutionStrategy {
  // RULE 1: Human deletions are intentional
  if (conflict.human_change.type === 'delete') {
    return {
      strategy: 'accept_human',
      rationale: 'Human explicitly deleted this content',
      requires_confirmation: false
    };
  }
  
  // RULE 2: AI deletions need confirmation
  if (conflict.ai_change.type === 'delete' && conflict.human_change.type === 'modify') {
    return {
      strategy: 'keep_both_ask_user',
      rationale: 'AI wanted to remove content that human modified',
      requires_confirmation: true
    };
  }
  
  // RULE 3: Concurrent edits to same line
  if (conflict.type === 'concurrent_edit') {
    // Check if edits are compatible
    if (editsAreAdditive(conflict.human_change, conflict.ai_change)) {
      return {
        strategy: 'merge_both',
        rationale: 'Both edits add information, can be combined',
        requires_confirmation: false
      };
    } else {
      return {
        strategy: 'accept_human_show_ai_suggestion',
        rationale: 'Conflicting edits; showing AI suggestion as comment',
        requires_confirmation: false
      };
    }
  }
  
  // RULE 4: Style conflicts → AI yields
  if (conflict.type === 'style_conflict') {
    return {
      strategy: 'accept_human',
      rationale: 'Style preference deferred to human',
      requires_confirmation: false
    };
  }
  
  // RULE 5: Structural conflicts → Ask user
  if (conflict.type === 'structural_conflict') {
    return {
      strategy: 'ask_user',
      rationale: 'Document structure changed; need human decision',
      requires_confirmation: true,
      options: [
        { label: 'Keep my structure', action: 'accept_human' },
        { label: 'Use AI structure', action: 'accept_ai' },
        { label: 'Show both', action: 'show_diff' }
      ]
    };
  }
  
  // DEFAULT: Human wins
  return {
    strategy: 'accept_human',
    rationale: 'Default: human intent takes precedence',
    requires_confirmation: false
  };
}
```

### 5.4 Merge Algorithm for Compatible Edits

```typescript
function mergeCompatibleEdits(
  human: Change,
  ai: Change,
  base: string
): MergeResult {
  // Use operational transformation for text
  if (human.type === 'insert' && ai.type === 'insert') {
    // Both inserting at same position
    if (human.position === ai.position) {
      // Human first, then AI
      return {
        result: base.slice(0, human.position) + 
                human.content + 
                ai.content + 
                base.slice(human.position),
        human_preserved: true,
        ai_preserved: true
      };
    }
  }
  
  // For complex merges, use CRDT
  return crdtMerge(human, ai, base);
}
```

### 5.5 What NOT To Do (Failure Modes)

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Silently discard human edits** | User loses work, loses trust | Always preserve or ask |
| **AI overwrites without notice** | Frustrating UX | Show diff, let user choose |
| **Asking for every tiny conflict** | Interruption fatigue | Auto-resolve style conflicts |
| **Complex merge UI** | Users don't understand | Simple: "Keep mine / Use AI / Both" |
| **No undo after resolution** | Mistakes are permanent | Always allow undo |

### 5.6 Conflict Prevention

```typescript
// PROACTIVE MEASURES to reduce conflicts

interface CollaborationSession {
  human_cursor_position: number;
  human_active_region: Range;
  ai_planned_edits: PlannedEdit[];
}

function shouldAIEditNow(
  session: CollaborationSession,
  planned_edit: PlannedEdit
): boolean {
  // RULE 1: Don't edit near human cursor
  const CURSOR_BUFFER = 500; // characters
  if (Math.abs(planned_edit.position - session.human_cursor_position) < CURSOR_BUFFER) {
    return false; // Wait
  }
  
  // RULE 2: Don't edit in human's active region
  if (rangesOverlap(planned_edit.range, session.human_active_region)) {
    return false; // Wait
  }
  
  // RULE 3: Don't edit if human is actively typing
  if (session.human_typing_velocity > 0) {
    return false; // Wait for pause
  }
  
  return true;
}
```

---

## 6. Email-Triggered Task Ingestion

### 6.1 Core Philosophy

Email is a **lossy, ambiguous channel**. The ingestion system must be paranoid about intent extraction and aggressive about confirmation.

### 6.2 Email Parsing Pipeline

```typescript
interface IngestedEmail {
  id: string;
  from: string;
  subject: string;
  body_plain: string;
  body_html?: string;
  attachments: Attachment[];
  received_at: number;
  thread_id?: string;
  in_reply_to?: string;
}

interface ExtractedTask {
  confidence: number;
  intent: string;
  parameters: Record<string, any>;
  ambiguities: Ambiguity[];
  requires_confirmation: boolean;
  suggested_clarifications: string[];
}

async function ingestEmail(email: IngestedEmail): Promise<ExtractedTask> {
  // STEP 1: Classify email type
  const classification = await classifyEmail(email);
  
  if (classification.type === 'not_a_task') {
    return {
      confidence: classification.confidence,
      intent: 'none',
      parameters: {},
      ambiguities: [],
      requires_confirmation: false,
      suggested_clarifications: []
    };
  }
  
  // STEP 2: Extract intent
  const intent = await extractIntent(email, classification);
  
  // STEP 3: Extract parameters
  const parameters = await extractParameters(email, intent);
  
  // STEP 4: Identify ambiguities
  const ambiguities = identifyAmbiguities(intent, parameters);
  
  // STEP 5: Decide if confirmation needed
  const requires_confirmation = shouldRequireConfirmation(intent, ambiguities);
  
  return {
    confidence: calculateOverallConfidence(intent, parameters, ambiguities),
    intent: intent.action,
    parameters,
    ambiguities,
    requires_confirmation,
    suggested_clarifications: generateClarifications(ambiguities)
  };
}
```

### 6.3 Email Classification

```typescript
interface EmailClassification {
  type: 'task_request' | 'information' | 'question' | 'not_a_task';
  confidence: number;
  signals: string[];
}

async function classifyEmail(email: IngestedEmail): Promise<EmailClassification> {
  // HEURISTIC SIGNALS (fast, no LLM)
  const signals: string[] = [];
  
  // Signal: Imperative verbs in subject
  const imperativePattern = /^(create|make|build|generate|send|schedule|book|find|research|analyze)/i;
  if (imperativePattern.test(email.subject)) {
    signals.push('imperative_subject');
  }
  
  // Signal: Question marks
  if (email.subject.includes('?') || email.body_plain.split('?').length > 2) {
    signals.push('question_heavy');
  }
  
  // Signal: Attachments with data
  if (email.attachments.some(a => isDataFile(a))) {
    signals.push('has_data_attachment');
  }
  
  // Signal: Deadline mentions
  const deadlinePattern = /by (monday|tuesday|wednesday|thursday|friday|tomorrow|end of|eod|cob|\d{1,2}\/\d{1,2})/i;
  if (deadlinePattern.test(email.body_plain)) {
    signals.push('has_deadline');
  }
  
  // LLM classification for ambiguous cases
  if (signals.length < 2) {
    const llmClassification = await classifyWithLLM(email);
    return llmClassification;
  }
  
  // Heuristic decision
  if (signals.includes('imperative_subject') || signals.includes('has_deadline')) {
    return { type: 'task_request', confidence: 0.8, signals };
  }
  
  if (signals.includes('question_heavy')) {
    return { type: 'question', confidence: 0.7, signals };
  }
  
  return { type: 'information', confidence: 0.6, signals };
}
```

### 6.4 Ambiguity Detection

```typescript
interface Ambiguity {
  type: 'missing_parameter' | 'unclear_scope' | 'multiple_interpretations' | 'implicit_assumption';
  description: string;
  severity: 'low' | 'medium' | 'high';
  possible_values?: string[];
}

function identifyAmbiguities(
  intent: ExtractedIntent,
  parameters: Record<string, any>
): Ambiguity[] {
  const ambiguities: Ambiguity[] = [];
  
  // Check for missing required parameters
  const requiredParams = INTENT_REQUIRED_PARAMS[intent.action] || [];
  for (const param of requiredParams) {
    if (!parameters[param]) {
      ambiguities.push({
        type: 'missing_parameter',
        description: `Required parameter "${param}" not specified`,
        severity: 'high'
      });
    }
  }
  
  // Check for vague scope
  if (intent.action === 'research' && !parameters.depth) {
    ambiguities.push({
      type: 'unclear_scope',
      description: 'Research depth not specified (quick overview vs. deep dive)',
      severity: 'medium',
      possible_values: ['quick overview (5 min)', 'standard (15 min)', 'deep dive (1 hour)']
    });
  }
  
  // Check for implicit assumptions
  if (parameters.format && !parameters.format_explicitly_stated) {
    ambiguities.push({
      type: 'implicit_assumption',
      description: `Assuming output format: ${parameters.format}`,
      severity: 'low'
    });
  }
  
  // Check for multiple interpretations
  if (intent.alternative_interpretations?.length > 0) {
    ambiguities.push({
      type: 'multiple_interpretations',
      description: 'Request could mean multiple things',
      severity: 'high',
      possible_values: intent.alternative_interpretations
    });
  }
  
  return ambiguities;
}
```

### 6.5 Confirmation Decision Logic

```typescript
function shouldRequireConfirmation(
  intent: ExtractedIntent,
  ambiguities: Ambiguity[]
): boolean {
  // ALWAYS confirm for high-risk actions
  const HIGH_RISK_ACTIONS = ['send_email', 'publish', 'delete', 'payment', 'booking'];
  if (HIGH_RISK_ACTIONS.includes(intent.action)) {
    return true;
  }
  
  // Confirm if any high-severity ambiguity
  if (ambiguities.some(a => a.severity === 'high')) {
    return true;
  }
  
  // Confirm if confidence below threshold
  if (intent.confidence < 0.7) {
    return true;
  }
  
  // Confirm if estimated cost is high
  if (intent.estimated_credits > 10) {
    return true;
  }
  
  // Don't confirm for low-risk, high-confidence tasks
  return false;
}
```

### 6.6 What NOT To Do (Failure Modes)

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Auto-execute from email** | Dangerous, easy to spoof | Always confirm high-risk |
| **Parse HTML email as task** | HTML is for display, not semantics | Use plain text primarily |
| **Trust sender blindly** | Email spoofing is trivial | Verify sender for sensitive actions |
| **Ignore thread context** | Miss crucial context | Parse entire thread |
| **One-shot intent extraction** | Misses nuance | Extract, validate, clarify |
| **No rate limiting** | Email bombing attack | Max 10 tasks/hour/sender |

### 6.7 Security Considerations

```typescript
const EMAIL_SECURITY_RULES = {
  // Sender verification
  REQUIRE_DKIM: true,
  REQUIRE_SPF: true,
  ALLOWED_DOMAINS: ['company.com', 'verified-partner.com'],
  
  // Rate limiting
  MAX_TASKS_PER_HOUR: 10,
  MAX_TASKS_PER_DAY: 50,
  
  // Content limits
  MAX_BODY_LENGTH: 50000,
  MAX_ATTACHMENTS: 10,
  MAX_ATTACHMENT_SIZE_MB: 25,
  
  // Blocked patterns
  BLOCKED_ACTIONS_FROM_EMAIL: ['delete_account', 'change_password', 'export_all_data'],
  
  // Confirmation requirements
  ALWAYS_CONFIRM_ACTIONS: ['send_email', 'publish', 'payment', 'booking', 'share_externally']
};
```

---

## 7. Confidence Scoring → UI Transparency

### 7.1 Core Philosophy

Users don't need to see confidence scores. They need to see **appropriate hedging in language** and **visual cues** that match the actual reliability of information.

### 7.2 Confidence Score Components

```typescript
interface ConfidenceScore {
  overall: number;                    // 0-1
  components: {
    source_quality: number;           // Quality of underlying sources
    source_agreement: number;         // Do sources agree?
    recency: number;                  // How fresh is the information?
    specificity: number;              // How specific vs. general?
    verification_level: number;       // Has this been fact-checked?
  };
  factors: ConfidenceFactor[];        // Explanations for the score
}

interface ConfidenceFactor {
  direction: 'positive' | 'negative';
  weight: number;
  description: string;
}
```

### 7.3 Confidence Calculation

```typescript
function calculateConfidence(
  claim: string,
  sources: Source[],
  context: ExecutionContext
): ConfidenceScore {
  // SOURCE QUALITY
  const source_quality = sources.length > 0
    ? sources.reduce((acc, s) => acc + s.quality_score, 0) / sources.length
    : 0.3; // No sources = low confidence
  
  // SOURCE AGREEMENT
  const source_agreement = calculateSourceAgreement(claim, sources);
  
  // RECENCY
  const recency = calculateRecencyScore(sources);
  
  // SPECIFICITY
  const specificity = calculateSpecificityScore(claim);
  
  // VERIFICATION
  const verification_level = sources.some(s => s.is_primary_source) ? 0.9 :
                             sources.some(s => s.is_authoritative) ? 0.7 : 0.5;
  
  // WEIGHTED COMBINATION
  const overall = (
    source_quality * 0.25 +
    source_agreement * 0.25 +
    recency * 0.15 +
    specificity * 0.15 +
    verification_level * 0.20
  );
  
  // BUILD FACTORS
  const factors: ConfidenceFactor[] = [];
  
  if (sources.length === 0) {
    factors.push({
      direction: 'negative',
      weight: 0.3,
      description: 'No external sources found'
    });
  }
  
  if (source_agreement < 0.5) {
    factors.push({
      direction: 'negative',
      weight: 0.2,
      description: 'Sources contain conflicting information'
    });
  }
  
  if (sources.some(s => s.is_primary_source)) {
    factors.push({
      direction: 'positive',
      weight: 0.2,
      description: 'Includes primary source'
    });
  }
  
  return {
    overall,
    components: { source_quality, source_agreement, recency, specificity, verification_level },
    factors
  };
}
```

### 7.4 Confidence → Language Mapping

```typescript
function confidenceToLanguage(confidence: number): LanguageGuidance {
  if (confidence >= 0.9) {
    return {
      hedging: 'none',
      verbs: ['is', 'shows', 'demonstrates', 'confirms'],
      qualifiers: [],
      example: 'The data shows a 15% increase.'
    };
  }
  
  if (confidence >= 0.7) {
    return {
      hedging: 'light',
      verbs: ['indicates', 'suggests', 'points to'],
      qualifiers: ['generally', 'typically'],
      example: 'The data suggests a 15% increase.'
    };
  }
  
  if (confidence >= 0.5) {
    return {
      hedging: 'moderate',
      verbs: ['may indicate', 'appears to show', 'seems to suggest'],
      qualifiers: ['possibly', 'potentially', 'in some cases'],
      example: 'The data appears to show approximately a 15% increase.'
    };
  }
  
  if (confidence >= 0.3) {
    return {
      hedging: 'heavy',
      verbs: ['might', 'could potentially', 'some sources suggest'],
      qualifiers: ['uncertain', 'limited data suggests', 'preliminary'],
      example: 'Limited data suggests there might be around a 15% increase, though this is uncertain.'
    };
  }
  
  return {
    hedging: 'maximum',
    verbs: ['is unclear', 'cannot be determined', 'insufficient data'],
    qualifiers: ['highly uncertain', 'speculative', 'unverified'],
    example: 'It is unclear whether there has been an increase; available data is insufficient.'
  };
}
```

### 7.5 UI Transparency Patterns

```typescript
interface UIConfidenceDisplay {
  show_indicator: boolean;
  indicator_type: 'none' | 'subtle' | 'prominent';
  tooltip_content?: string;
  expandable_details: boolean;
}

function confidenceToUIDisplay(
  confidence: ConfidenceScore,
  context: UIContext
): UIConfidenceDisplay {
  // HIGH CONFIDENCE: No indicator needed
  if (confidence.overall >= 0.8) {
    return {
      show_indicator: false,
      indicator_type: 'none',
      expandable_details: false
    };
  }
  
  // MEDIUM CONFIDENCE: Subtle indicator
  if (confidence.overall >= 0.5) {
    return {
      show_indicator: true,
      indicator_type: 'subtle',
      tooltip_content: summarizeConfidenceFactors(confidence.factors),
      expandable_details: true
    };
  }
  
  // LOW CONFIDENCE: Prominent warning
  return {
    show_indicator: true,
    indicator_type: 'prominent',
    tooltip_content: summarizeConfidenceFactors(confidence.factors),
    expandable_details: true
  };
}
```

### 7.6 Visual Confidence Indicators

```typescript
// CSS classes for confidence levels
const CONFIDENCE_STYLES = {
  high: {
    border: 'none',
    background: 'transparent',
    icon: null
  },
  medium: {
    border: '1px dashed var(--warning-subtle)',
    background: 'var(--warning-bg-subtle)',
    icon: 'info-circle'  // ℹ️
  },
  low: {
    border: '2px solid var(--warning)',
    background: 'var(--warning-bg)',
    icon: 'alert-triangle'  // ⚠️
  },
  very_low: {
    border: '2px solid var(--error)',
    background: 'var(--error-bg)',
    icon: 'alert-octagon'  // 🛑
  }
};
```

### 7.7 What NOT To Do (Failure Modes)

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Show raw confidence %** | Users misinterpret (73% ≠ "pretty sure") | Use language hedging |
| **Binary confident/not** | Loses nuance | Gradient indicators |
| **Confidence on everything** | Visual noise | Only show when < 0.8 |
| **No explanation** | "Why is this uncertain?" | Expandable factors |
| **Overconfident language** | Erodes trust when wrong | Match language to confidence |
| **Hiding uncertainty** | Users make bad decisions | Always surface low confidence |

### 7.8 Confidence Calibration

```typescript
// CRITICAL: Calibrate confidence scores against actual accuracy

interface CalibrationData {
  predicted_confidence: number;
  actual_correct: boolean;
  timestamp: number;
  claim_type: string;
}

function calibrateConfidenceModel(
  historical_data: CalibrationData[]
): CalibrationAdjustment {
  // Group by confidence bucket
  const buckets = groupByConfidenceBucket(historical_data, 0.1);
  
  // For each bucket, calculate actual accuracy
  const calibration: Record<string, number> = {};
  for (const [bucket, data] of Object.entries(buckets)) {
    const accuracy = data.filter(d => d.actual_correct).length / data.length;
    const predicted = parseFloat(bucket);
    calibration[bucket] = accuracy / predicted; // Adjustment factor
  }
  
  // If we're consistently overconfident, apply penalty
  const avgAdjustment = Object.values(calibration).reduce((a, b) => a + b, 0) / 
                        Object.values(calibration).length;
  
  return {
    bucket_adjustments: calibration,
    global_adjustment: avgAdjustment,
    is_overconfident: avgAdjustment < 0.9,
    is_underconfident: avgAdjustment > 1.1
  };
}
```

---

## Summary: The Intelligence Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MANUS INTELLIGENCE STACK                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   PLANNER   │───▶│  RESEARCH   │───▶│  SYNTHESIS  │───▶│   OUTPUT    │  │
│  │             │    │             │    │             │    │             │  │
│  │ • Score     │    │ • Decompose │    │ • Narrative │    │ • Confidence│  │
│  │ • Repair    │    │ • Parallel  │    │ • Visualize │    │ • Language  │  │
│  │ • Abort     │    │ • Prune     │    │ • Reject    │    │ • UI cues   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                                                        │          │
│         │              ┌─────────────┐                          │          │
│         └─────────────▶│   COLLAB    │◀─────────────────────────┘          │
│                        │             │                                      │
│                        │ • Conflict  │                                      │
│                        │ • Merge     │                                      │
│                        │ • Human wins│                                      │
│                        └─────────────┘                                      │
│                               │                                             │
│                               ▼                                             │
│                        ┌─────────────┐                                      │
│                        │   INGEST    │                                      │
│                        │             │                                      │
│                        │ • Email     │                                      │
│                        │ • Ambiguity │                                      │
│                        │ • Confirm   │                                      │
│                        └─────────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

| Subsystem | Must Have | Nice to Have | Explicitly Vague |
|-----------|-----------|--------------|------------------|
| **Planner** | Score, Repair, Abort thresholds | Plan caching | Scoring weights (tune to product) |
| **Research** | Parallel execution, Diminishing returns | Source ranking ML | Query expansion strategy |
| **Presentation** | Narrative arc, Hook construction | Template library | Emotional tone selection |
| **Visualization** | Rejection rules, Chart selection | Auto-styling | Color palette choice |
| **Collaboration** | Human-wins rule, Conflict detection | Real-time cursors | Merge algorithm details |
| **Email** | Classification, Confirmation logic | Thread parsing | Allowed domains |
| **Confidence** | Score calculation, Language mapping | Calibration loop | UI indicator thresholds |

---

*This guide represents hard-won lessons from building AI agent systems. The specific thresholds and weights are starting points — calibrate them against your user feedback and error patterns.*
