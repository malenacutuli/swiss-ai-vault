"""
Tests for Prompt Management System

Production-grade tests for version management, templates,
A/B testing, metrics, and optimization.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, MagicMock
from app.prompts.version_manager import PromptVersionManager, PromptVersion, PromptStatus
from app.prompts.template_system import PromptTemplateSystem, PromptTemplate
from app.prompts.ab_testing import ABTestingFramework, ABTest, TestStatus
from app.prompts.metrics import MetricsTracker, PromptMetrics
from app.prompts.optimizer import PromptOptimizer, OptimizationRecommendation


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def mock_supabase():
    """Mock Supabase client."""
    mock = Mock()
    mock.table = Mock(return_value=mock)
    mock.select = Mock(return_value=mock)
    mock.insert = Mock(return_value=mock)
    mock.update = Mock(return_value=mock)
    mock.delete = Mock(return_value=mock)
    mock.eq = Mock(return_value=mock)
    mock.order = Mock(return_value=mock)
    mock.limit = Mock(return_value=mock)
    mock.execute = Mock(return_value=Mock(data=[]))
    return mock


# ============================================================================
# PromptVersion Tests
# ============================================================================

def test_prompt_version_initialization():
    """Test PromptVersion initialization."""
    version = PromptVersion(
        prompt_id="test-prompt",
        version=1,
        content="Test prompt content",
        system_prompt="You are a helpful assistant",
        metadata={"author": "test"},
        status="draft"
    )

    assert version.prompt_id == "test-prompt"
    assert version.version == 1
    assert version.content == "Test prompt content"
    assert version.status == PromptStatus.DRAFT
    assert version.metadata["author"] == "test"


def test_prompt_version_to_dict():
    """Test PromptVersion to_dict conversion."""
    version = PromptVersion(
        prompt_id="test-prompt",
        version=1,
        content="Test content",
        system_prompt="System prompt",
        id="version-id-123"
    )

    data = version.to_dict()

    assert data["id"] == "version-id-123"
    assert data["prompt_id"] == "test-prompt"
    assert data["version"] == 1
    assert data["status"] == "draft"


def test_prompt_version_from_dict():
    """Test PromptVersion from_dict creation."""
    data = {
        "id": "version-id-123",
        "prompt_id": "test-prompt",
        "version": 1,
        "content": "Test content",
        "system_prompt": "System prompt",
        "metadata": {"key": "value"},
        "status": "active",
        "created_at": "2024-01-01T00:00:00"
    }

    version = PromptVersion.from_dict(data)

    assert version.id == "version-id-123"
    assert version.prompt_id == "test-prompt"
    assert version.status == PromptStatus.ACTIVE


# ============================================================================
# PromptVersionManager Tests
# ============================================================================

@pytest.mark.asyncio
async def test_create_version(mock_supabase):
    """Test creating a new prompt version."""
    # Setup mock response
    mock_supabase.execute.return_value.data = [{
        "id": "new-version-id",
        "prompt_id": "test-prompt",
        "version": 1,
        "content": "Test content",
        "system_prompt": "System prompt",
        "metadata": {},
        "status": "draft",
        "created_at": datetime.utcnow().isoformat()
    }]

    manager = PromptVersionManager(mock_supabase)
    version = await manager.create_version(
        prompt_id="test-prompt",
        content="Test content",
        system_prompt="System prompt",
        user_id="user-123"
    )

    assert version.prompt_id == "test-prompt"
    assert version.version == 1
    assert version.status == PromptStatus.DRAFT


@pytest.mark.asyncio
async def test_get_active_version(mock_supabase):
    """Test getting active version."""
    mock_supabase.execute.return_value.data = [{
        "id": "active-version-id",
        "prompt_id": "test-prompt",
        "version": 2,
        "content": "Active content",
        "system_prompt": "System prompt",
        "metadata": {},
        "status": "active",
        "created_at": datetime.utcnow().isoformat()
    }]

    manager = PromptVersionManager(mock_supabase)
    version = await manager.get_active_version("test-prompt")

    assert version is not None
    assert version.status == PromptStatus.ACTIVE
    assert version.version == 2


@pytest.mark.asyncio
async def test_activate_version(mock_supabase):
    """Test activating a version."""
    # Mock getting the version
    mock_supabase.execute.return_value.data = [{
        "id": "version-id",
        "prompt_id": "test-prompt",
        "version": 2,
        "content": "Content",
        "system_prompt": "System",
        "metadata": {},
        "status": "draft",
        "created_at": datetime.utcnow().isoformat()
    }]

    manager = PromptVersionManager(mock_supabase)
    success = await manager.activate_version(
        prompt_id="test-prompt",
        version=2,
        user_id="user-123"
    )

    assert success is True


# ============================================================================
# PromptTemplate Tests
# ============================================================================

def test_template_render():
    """Test template rendering with variables."""
    template = PromptTemplate(
        template_id="test-template",
        name="Test Template",
        template="Hello {{name}}, you have {{count}} messages",
        variables=["name", "count"]
    )

    rendered = template.render({"name": "Alice", "count": 5})

    assert rendered == "Hello Alice, you have 5 messages"


def test_template_render_missing_variable():
    """Test template rendering with missing variables."""
    template = PromptTemplate(
        template_id="test-template",
        name="Test Template",
        template="Hello {{name}}",
        variables=["name"]
    )

    with pytest.raises(ValueError, match="Missing required variables"):
        template.render({})


def test_template_extract_variables():
    """Test extracting variables from template."""
    template = PromptTemplate(
        template_id="test-template",
        name="Test Template",
        template="{{greeting}} {{name}}, {{message}}",
        variables=["greeting", "name", "message"]
    )

    variables = template.extract_variables()

    assert variables == {"greeting", "name", "message"}


def test_template_validate():
    """Test template validation."""
    # Valid template
    template = PromptTemplate(
        template_id="test-template",
        name="Test Template",
        template="Hello {{name}}",
        variables=["name"]
    )

    assert template.validate_template() is True

    # Invalid template - missing declared variable
    invalid_template = PromptTemplate(
        template_id="test-template",
        name="Test Template",
        template="Hello {{name}}",
        variables=["name", "extra"]
    )

    with pytest.raises(ValueError, match="declared but unused variables"):
        invalid_template.validate_template()


# ============================================================================
# PromptTemplateSystem Tests
# ============================================================================

@pytest.mark.asyncio
async def test_create_template(mock_supabase):
    """Test creating a template."""
    mock_supabase.execute.return_value.data = [{
        "id": "template-id",
        "template_id": "greeting",
        "name": "Greeting Template",
        "template": "Hello {{name}}",
        "variables": ["name"],
        "description": "Test template",
        "created_at": datetime.utcnow().isoformat()
    }]

    system = PromptTemplateSystem(mock_supabase)
    template = await system.create_template(
        template_id="greeting",
        name="Greeting Template",
        template="Hello {{name}}",
        description="Test template",
        user_id="user-123"
    )

    assert template.template_id == "greeting"
    assert template.variables == ["name"]


@pytest.mark.asyncio
async def test_render_template(mock_supabase):
    """Test rendering a template."""
    mock_supabase.execute.return_value.data = [{
        "id": "template-id",
        "template_id": "greeting",
        "name": "Greeting Template",
        "template": "Hello {{name}}",
        "variables": ["name"],
        "description": None,
        "created_at": datetime.utcnow().isoformat()
    }]

    system = PromptTemplateSystem(mock_supabase)
    rendered = await system.render_template("greeting", {"name": "Bob"})

    assert rendered == "Hello Bob"


# ============================================================================
# ABTest Tests
# ============================================================================

def test_ab_test_assign_variant():
    """Test variant assignment."""
    test = ABTest(
        test_id="test-1",
        prompt_a_id="prompt-a",
        prompt_b_id="prompt-b",
        split=0.5
    )

    # Run multiple times to check randomness
    variants = [test.assign_variant() for _ in range(100)]

    assert "a" in variants
    assert "b" in variants


def test_ab_test_get_variant_prompt_id():
    """Test getting prompt ID for variant."""
    test = ABTest(
        test_id="test-1",
        prompt_a_id="prompt-a",
        prompt_b_id="prompt-b"
    )

    assert test.get_variant_prompt_id("a") == "prompt-a"
    assert test.get_variant_prompt_id("b") == "prompt-b"


def test_ab_test_calculate_winner():
    """Test winner calculation."""
    # Test with clear winner
    test = ABTest(
        test_id="test-1",
        prompt_a_id="prompt-a",
        prompt_b_id="prompt-b",
        metrics_a={"count": 50, "success_rate": 0.8},
        metrics_b={"count": 50, "success_rate": 0.6}
    )

    winner = test.calculate_winner()
    assert winner == "a"

    # Test with insufficient data
    test_no_data = ABTest(
        test_id="test-2",
        prompt_a_id="prompt-a",
        prompt_b_id="prompt-b",
        metrics_a={"count": 10, "success_rate": 0.9},
        metrics_b={"count": 10, "success_rate": 0.5}
    )

    winner = test_no_data.calculate_winner()
    assert winner is None


# ============================================================================
# ABTestingFramework Tests
# ============================================================================

@pytest.mark.asyncio
async def test_create_ab_test(mock_supabase):
    """Test creating an A/B test."""
    mock_supabase.execute.return_value.data = [{
        "id": "test-id",
        "test_id": "test-1",
        "prompt_a_id": "prompt-a",
        "prompt_b_id": "prompt-b",
        "split": 0.5,
        "status": "running",
        "metrics_a": {},
        "metrics_b": {},
        "winner": None,
        "created_at": datetime.utcnow().isoformat()
    }]

    framework = ABTestingFramework(mock_supabase)
    test = await framework.create_test(
        test_id="test-1",
        prompt_a_id="prompt-a",
        prompt_b_id="prompt-b",
        user_id="user-123"
    )

    assert test.test_id == "test-1"
    assert test.status == TestStatus.RUNNING


@pytest.mark.asyncio
async def test_update_metrics(mock_supabase):
    """Test updating test metrics."""
    # Mock get_test
    mock_supabase.execute.return_value.data = [{
        "id": "test-id",
        "test_id": "test-1",
        "prompt_a_id": "prompt-a",
        "prompt_b_id": "prompt-b",
        "split": 0.5,
        "status": "running",
        "metrics_a": {"count": 0, "success_count": 0, "total_latency": 0.0, "scores": []},
        "metrics_b": {},
        "winner": None,
        "created_at": datetime.utcnow().isoformat()
    }]

    framework = ABTestingFramework(mock_supabase)
    success = await framework.update_metrics(
        test_id="test-1",
        variant="a",
        success=True,
        latency=150.5,
        score=85.0
    )

    assert success is True


# ============================================================================
# MetricsTracker Tests
# ============================================================================

@pytest.mark.asyncio
async def test_record_execution(mock_supabase):
    """Test recording execution metrics."""
    mock_supabase.execute.return_value.data = [{"id": "metric-id"}]

    tracker = MetricsTracker(mock_supabase)
    success = await tracker.record_execution(
        prompt_id="test-prompt",
        success=True,
        latency=120.5,
        version=1,
        score=90.0
    )

    assert success is True


@pytest.mark.asyncio
async def test_get_metrics(mock_supabase):
    """Test getting aggregated metrics."""
    # Mock metrics data
    now = datetime.utcnow()
    mock_supabase.execute.return_value.data = [
        {
            "prompt_id": "test-prompt",
            "version": 1,
            "success": True,
            "latency": 100.0,
            "score": 85.0,
            "created_at": now.isoformat()
        },
        {
            "prompt_id": "test-prompt",
            "version": 1,
            "success": True,
            "latency": 150.0,
            "score": 90.0,
            "created_at": now.isoformat()
        },
        {
            "prompt_id": "test-prompt",
            "version": 1,
            "success": False,
            "latency": 200.0,
            "score": None,
            "created_at": now.isoformat()
        }
    ]

    tracker = MetricsTracker(mock_supabase)
    metrics = await tracker.get_metrics("test-prompt", version=1, days=30)

    assert metrics is not None
    assert metrics.count == 3
    assert metrics.success_count == 2
    assert metrics.success_rate == 2/3
    assert metrics.avg_latency == 150.0
    assert metrics.avg_score == 87.5


# ============================================================================
# PromptOptimizer Tests
# ============================================================================

@pytest.mark.asyncio
async def test_get_optimal_prompt(mock_supabase):
    """Test getting optimal prompt."""
    # Mock active version
    mock_supabase.execute.return_value.data = [{
        "id": "version-id",
        "prompt_id": "test-prompt",
        "version": 2,
        "content": "Optimized content",
        "system_prompt": "System prompt",
        "metadata": {},
        "status": "active",
        "created_at": datetime.utcnow().isoformat()
    }]

    optimizer = PromptOptimizer(mock_supabase)
    version = await optimizer.get_optimal_prompt("test-prompt")

    assert version is not None
    assert version.status == PromptStatus.ACTIVE


@pytest.mark.asyncio
async def test_analyze_performance(mock_supabase):
    """Test performance analysis."""
    # Mock versions
    mock_supabase.execute.return_value.data = [
        {
            "id": "v1",
            "prompt_id": "test-prompt",
            "version": 1,
            "content": "V1",
            "system_prompt": "System",
            "metadata": {},
            "status": "active",
            "created_at": datetime.utcnow().isoformat()
        }
    ]

    optimizer = PromptOptimizer(mock_supabase)
    analysis = await optimizer.analyze_performance("test-prompt", days=30)

    assert "prompt_id" in analysis
    assert analysis["prompt_id"] == "test-prompt"


def test_optimization_recommendation():
    """Test OptimizationRecommendation creation."""
    rec = OptimizationRecommendation(
        prompt_id="test-prompt",
        recommendation_type="version_upgrade",
        current_version=1,
        suggested_version=2,
        confidence="high",
        reason="Version 2 shows 15% improvement",
        metrics={"improvement": 0.15}
    )

    assert rec.recommendation_type == "version_upgrade"
    assert rec.confidence == "high"
    assert rec.metrics["improvement"] == 0.15

    rec_dict = rec.to_dict()
    assert rec_dict["prompt_id"] == "test-prompt"
    assert rec_dict["suggested_version"] == 2


# ============================================================================
# Integration Tests
# ============================================================================

@pytest.mark.asyncio
async def test_full_workflow(mock_supabase):
    """Test complete workflow: version -> test -> metrics -> optimize."""
    # This is a simplified integration test
    # In production, use real database for integration tests

    # 1. Create version
    mock_supabase.execute.return_value.data = [{
        "id": "v1",
        "prompt_id": "workflow-test",
        "version": 1,
        "content": "Test content",
        "system_prompt": "System",
        "metadata": {},
        "status": "draft",
        "created_at": datetime.utcnow().isoformat()
    }]

    manager = PromptVersionManager(mock_supabase)
    version = await manager.create_version(
        prompt_id="workflow-test",
        content="Test content",
        system_prompt="System",
        user_id="user-123"
    )

    assert version.version == 1

    # 2. Record metrics
    tracker = MetricsTracker(mock_supabase)
    await tracker.record_execution(
        prompt_id="workflow-test",
        success=True,
        latency=100.0,
        version=1,
        score=85.0
    )

    # 3. Get recommendations
    optimizer = PromptOptimizer(mock_supabase)
    recommendations = await optimizer.get_recommendations("workflow-test")

    # Should complete without errors
    assert isinstance(recommendations, list)
