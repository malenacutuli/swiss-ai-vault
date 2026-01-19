# Phase 5: Prompt Management System

Production-grade prompt versioning, A/B testing, metrics tracking, and intelligent optimization for the Swiss Agent API.

## Overview

Phase 5 implements a comprehensive prompt management system that enables:
- **Version Control**: Track and manage prompt versions with activation and rollback
- **Template System**: Reusable prompt templates with variable substitution
- **A/B Testing**: Compare prompt variants with statistical analysis
- **Metrics Tracking**: Monitor performance, success rates, and quality scores
- **Intelligent Optimization**: Automated recommendations and selection

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Prompt Management System                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Version    │  │   Template   │  │   A/B Test   │      │
│  │  Management  │  │    System    │  │  Framework   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                   │              │
│         └─────────────────┼───────────────────┘              │
│                           │                                  │
│         ┌─────────────────┴─────────────────┐               │
│         │                                    │               │
│  ┌──────▼──────┐                   ┌────────▼────────┐     │
│  │   Metrics   │                   │    Optimizer    │     │
│  │   Tracker   │◄──────────────────┤   Intelligence  │     │
│  └─────────────┘                   └─────────────────┘     │
│         │                                    │               │
└─────────┼────────────────────────────────────┼──────────────┘
          │                                    │
          ▼                                    ▼
    ┌──────────┐                        ┌──────────┐
    │ Supabase │                        │  Agent   │
    │ Database │                        │ Executor │
    └──────────┘                        └──────────┘
```

## Components

### 1. Version Manager (`app/prompts/version_manager.py`)

Manages prompt versions with full lifecycle control.

**Features:**
- Create new versions with metadata
- Activate/deactivate versions
- List version history
- Rollback to previous versions
- Status management (draft, active, archived, deprecated)

**Example:**
```python
from app.prompts.version_manager import PromptVersionManager

manager = PromptVersionManager(supabase)

# Create new version
version = await manager.create_version(
    prompt_id="task-planner",
    content="You are an AI task planner...",
    system_prompt="Plan tasks efficiently",
    metadata={"author": "team"},
    user_id="user-123"
)

# Activate version
await manager.activate_version("task-planner", version=2)

# Rollback if needed
await manager.rollback_version("task-planner", version=1)
```

### 2. Template System (`app/prompts/template_system.py`)

Reusable prompt templates with variable substitution.

**Features:**
- Create templates with {{variable}} placeholders
- Automatic variable extraction
- Template validation
- Render templates with values

**Example:**
```python
from app.prompts.template_system import PromptTemplateSystem

system = PromptTemplateSystem(supabase)

# Create template
template = await system.create_template(
    template_id="code-review",
    name="Code Review Template",
    template="Review this {{language}} code:\n\n{{code}}\n\nFocus on {{focus_area}}",
    description="Template for code reviews"
)

# Render template
rendered = await system.render_template(
    "code-review",
    {
        "language": "Python",
        "code": "def hello(): return 'world'",
        "focus_area": "security"
    }
)
```

### 3. A/B Testing Framework (`app/prompts/ab_testing.py`)

Compare prompt variants with traffic splitting and winner determination.

**Features:**
- Create A/B tests with customizable traffic split
- Variant assignment and tracking
- Metrics aggregation per variant
- Statistical winner determination
- Test lifecycle management

**Example:**
```python
from app.prompts.ab_testing import ABTestingFramework

framework = ABTestingFramework(supabase)

# Create test
test = await framework.create_test(
    test_id="task-planner-v2-test",
    prompt_a_id="task-planner:v1",
    prompt_b_id="task-planner:v2",
    split=0.50  # 50/50 split
)

# Get variant for user
variant, prompt_id = await framework.assign_variant(test.test_id)

# Update metrics
await framework.update_metrics(
    test_id=test.test_id,
    variant=variant,
    success=True,
    latency=150.5,
    score=85.0
)

# Complete test and get winner
winner = await framework.complete_test(test.test_id)
```

### 4. Metrics Tracker (`app/prompts/metrics.py`)

Track and aggregate prompt execution metrics.

**Features:**
- Record execution metrics (success, latency, score)
- Aggregate metrics over time periods
- Compare versions
- Get top performing prompts
- Historical analysis

**Example:**
```python
from app.prompts.metrics import MetricsTracker

tracker = MetricsTracker(supabase)

# Record execution
await tracker.record_execution(
    prompt_id="task-planner",
    success=True,
    latency=120.5,
    version=2,
    score=90.0,
    metadata={"user_feedback": "excellent"}
)

# Get aggregated metrics
metrics = await tracker.get_metrics("task-planner", version=2, days=30)
print(f"Success rate: {metrics.success_rate:.2%}")
print(f"Avg latency: {metrics.avg_latency:.1f}ms")
print(f"Avg score: {metrics.avg_score:.1f}")

# Compare versions
comparison = await tracker.compare_versions(
    "task-planner",
    version_a=1,
    version_b=2,
    days=30
)
```

### 5. Optimizer (`app/prompts/optimizer.py`)

Intelligent prompt selection and optimization recommendations.

**Features:**
- Get optimal prompt based on performance
- Performance analysis across versions
- Automated recommendations
- Auto-optimization with activation
- Context-aware selection (future)

**Example:**
```python
from app.prompts.optimizer import PromptOptimizer

optimizer = PromptOptimizer(supabase)

# Get optimal prompt
version = await optimizer.get_optimal_prompt("task-planner")

# Get recommendations
recommendations = await optimizer.get_recommendations("task-planner", days=30)
for rec in recommendations:
    print(f"{rec.recommendation_type}: {rec.reason}")

# Auto-optimize
results = await optimizer.auto_optimize(
    "task-planner",
    auto_activate=True  # Automatically activate best version
)
```

## Database Schema

### Tables

**prompt_versions**
- `id` (UUID, PK)
- `prompt_id` (TEXT)
- `version` (INTEGER)
- `content` (TEXT)
- `system_prompt` (TEXT)
- `metadata` (JSONB)
- `status` (TEXT) - draft/active/archived/deprecated
- `created_at` (TIMESTAMP)
- `created_by` (UUID, FK → auth.users)
- `updated_at` (TIMESTAMP)
- UNIQUE(prompt_id, version)

**prompt_templates**
- `id` (UUID, PK)
- `template_id` (TEXT, UNIQUE)
- `name` (TEXT)
- `template` (TEXT)
- `variables` (JSONB)
- `description` (TEXT)
- `created_at` (TIMESTAMP)
- `created_by` (UUID, FK → auth.users)
- `updated_at` (TIMESTAMP)

**prompt_ab_tests**
- `id` (UUID, PK)
- `test_id` (TEXT, UNIQUE)
- `prompt_a_id` (TEXT)
- `prompt_b_id` (TEXT)
- `split` (DECIMAL)
- `status` (TEXT) - running/completed/archived
- `metrics_a` (JSONB)
- `metrics_b` (JSONB)
- `winner` (TEXT)
- `created_at` (TIMESTAMP)
- `started_at` (TIMESTAMP)
- `completed_at` (TIMESTAMP)

**prompt_metrics**
- `id` (UUID, PK)
- `prompt_id` (TEXT)
- `version` (INTEGER)
- `execution_id` (UUID)
- `success` (BOOLEAN)
- `latency` (DECIMAL)
- `score` (DECIMAL)
- `metadata` (JSONB)
- `created_at` (TIMESTAMP)

## API Endpoints

### Version Management

**Create Version**
```http
POST /api/prompts/versions
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt_id": "task-planner",
  "content": "You are an AI task planner...",
  "system_prompt": "Plan tasks efficiently",
  "metadata": {"author": "team"}
}
```

**List Versions**
```http
GET /api/prompts/versions/{prompt_id}
Authorization: Bearer <token>
```

**Get Active Version**
```http
GET /api/prompts/versions/{prompt_id}/active
Authorization: Bearer <token>
```

**Activate Version**
```http
POST /api/prompts/versions/activate
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt_id": "task-planner",
  "version": 2
}
```

### Template Management

**Create Template**
```http
POST /api/prompts/templates
Authorization: Bearer <token>
Content-Type: application/json

{
  "template_id": "code-review",
  "name": "Code Review Template",
  "template": "Review this {{language}} code:\n{{code}}",
  "description": "Code review template"
}
```

**Render Template**
```http
POST /api/prompts/templates/render
Authorization: Bearer <token>
Content-Type: application/json

{
  "template_id": "code-review",
  "values": {
    "language": "Python",
    "code": "def hello(): return 'world'"
  }
}
```

### A/B Testing

**Create Test**
```http
POST /api/prompts/ab-tests
Authorization: Bearer <token>
Content-Type: application/json

{
  "test_id": "task-planner-v2-test",
  "prompt_a_id": "task-planner:v1",
  "prompt_b_id": "task-planner:v2",
  "split": 0.50
}
```

**Get Test Results**
```http
GET /api/prompts/ab-tests/{test_id}/results
Authorization: Bearer <token>
```

**Complete Test**
```http
POST /api/prompts/ab-tests/{test_id}/complete
Authorization: Bearer <token>
```

### Metrics

**Record Execution**
```http
POST /api/prompts/metrics/record
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt_id": "task-planner",
  "success": true,
  "latency": 120.5,
  "version": 2,
  "score": 90.0
}
```

**Get Metrics**
```http
GET /api/prompts/metrics/{prompt_id}?version=2&days=30
Authorization: Bearer <token>
```

**Get Metrics History**
```http
GET /api/prompts/metrics/{prompt_id}/history?granularity=daily&days=30
Authorization: Bearer <token>
```

**Get Top Prompts**
```http
GET /api/prompts/metrics/top?limit=10&order_by=success_rate
Authorization: Bearer <token>
```

### Optimization

**Analyze Performance**
```http
GET /api/prompts/optimize/{prompt_id}/analyze?days=30
Authorization: Bearer <token>
```

**Get Recommendations**
```http
GET /api/prompts/optimize/{prompt_id}/recommendations?days=30
Authorization: Bearer <token>
```

**Auto-Optimize**
```http
POST /api/prompts/optimize
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt_id": "task-planner",
  "auto_activate": true
}
```

## Testing

### Run Tests
```bash
# Run all prompt management tests
pytest tests/test_prompts.py -v

# Run specific test
pytest tests/test_prompts.py::test_prompt_version_initialization -v

# Run with coverage
pytest tests/test_prompts.py --cov=app/prompts --cov-report=html
```

### Test Coverage
- Unit tests for all components
- Integration tests for workflows
- Mock Supabase for isolated testing
- Async test support with pytest-asyncio

## Deployment

### Prerequisites
- Database migration applied
- Tests passing
- Docker image built

### Deploy to Production
```bash
./deploy_phase5.sh
```

The deployment script will:
1. Run database migration
2. Execute test suite
3. Build Docker image
4. Push to registry
5. Update Kubernetes deployments
6. Verify rollout
7. Test endpoints

### Manual Deployment Steps

**1. Apply Migration**
```bash
supabase db push supabase_migrations/20260115000001_prompt_management.sql
```

**2. Build Image**
```bash
docker build --platform linux/amd64 -t docker.io/axessvideo/agent-api:v12-phase5 .
docker push docker.io/axessvideo/agent-api:v12-phase5
```

**3. Update Deployments**
```bash
kubectl set image deployment/agent-api agent-api=docker.io/axessvideo/agent-api:v12-phase5 -n agents
kubectl set image deployment/agent-worker agent-worker=docker.io/axessvideo/agent-api:v12-phase5 -n agents
kubectl rollout status deployment/agent-api -n agents
kubectl rollout status deployment/agent-worker -n agents
```

## Best Practices

### Version Management
- Use semantic versioning for major changes
- Always test in draft status before activating
- Keep metadata for audit trail
- Use rollback for quick recovery

### Templates
- Validate templates before production use
- Document required variables
- Use descriptive template IDs
- Version templates when making major changes

### A/B Testing
- Run tests for sufficient duration (minimum 30 samples per variant)
- Monitor metrics in real-time
- Use 50/50 split unless you have specific reasons
- Complete tests when statistical significance is reached

### Metrics
- Record all executions for accurate analysis
- Include quality scores when available
- Use metadata for additional context
- Clean up old metrics periodically (90+ days)

### Optimization
- Review recommendations before auto-activation
- Monitor performance after activation
- Keep underperforming versions as archived
- Use optimizer insights for prompt engineering

## Monitoring

### Key Metrics to Track
- **Success Rate**: Percentage of successful executions
- **Latency**: Average response time
- **Quality Score**: User satisfaction or quality metrics
- **Active Tests**: Number of running A/B tests
- **Version Distribution**: Usage across versions

### Alerts
Set up alerts for:
- Success rate drops below 80%
- Latency increases above 2x baseline
- Quality score drops below threshold
- A/B test reaches statistical significance

## Troubleshooting

### Version Not Activating
- Check version exists: `GET /api/prompts/versions/{prompt_id}`
- Verify version status is not deprecated
- Check logs for activation errors

### Template Rendering Fails
- Validate all required variables are provided
- Check template syntax ({{variable}})
- Verify template exists

### A/B Test Not Assigning Variants
- Confirm test status is "running"
- Check traffic split is valid (0 < split < 1)
- Verify prompt IDs exist

### Metrics Not Recording
- Check Supabase connection
- Verify prompt_id and version exist
- Review execution metadata for errors

## Future Enhancements

- **Context-Aware Selection**: Optimize prompts based on user context, task type, or historical patterns
- **Automated Experiments**: Automatically create and run A/B tests for new versions
- **Cost Optimization**: Factor in token usage and API costs in optimization
- **Multi-Armed Bandit**: Dynamic traffic allocation based on performance
- **Prompt Generation**: AI-generated prompt suggestions based on metrics
- **Cross-Prompt Analysis**: Compare performance across different prompt families

## References

- [Supabase Documentation](https://supabase.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [A/B Testing Best Practices](https://www.optimizely.com/optimization-glossary/ab-testing/)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)
