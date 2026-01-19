"""
Prompt Management API Routes

Production-grade REST API for prompt versioning, templates,
A/B testing, metrics, and optimization.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.config import get_settings
from app.auth.dependencies import get_current_user, get_supabase_client
from app.prompts.version_manager import PromptVersionManager
from app.prompts.template_system import PromptTemplateSystem
from app.prompts.ab_testing import ABTestingFramework
from app.prompts.metrics import MetricsTracker
from app.prompts.optimizer import PromptOptimizer
from supabase import Client

import structlog

logger = structlog.get_logger()

router = APIRouter(prefix="/api/prompts", tags=["Prompt Management"])


# ============================================================================
# Request/Response Models
# ============================================================================

class CreateVersionRequest(BaseModel):
    """Request to create new prompt version."""
    prompt_id: str = Field(..., description="Prompt identifier")
    content: str = Field(..., description="Prompt content")
    system_prompt: str = Field(..., description="System prompt")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")


class ActivateVersionRequest(BaseModel):
    """Request to activate prompt version."""
    prompt_id: str = Field(..., description="Prompt identifier")
    version: int = Field(..., description="Version number to activate")


class CreateTemplateRequest(BaseModel):
    """Request to create prompt template."""
    template_id: str = Field(..., description="Unique template identifier")
    name: str = Field(..., description="Template name")
    template: str = Field(..., description="Template string with {{variables}}")
    description: Optional[str] = Field(default=None, description="Template description")


class UpdateTemplateRequest(BaseModel):
    """Request to update prompt template."""
    name: Optional[str] = Field(default=None, description="New name")
    template: Optional[str] = Field(default=None, description="New template string")
    description: Optional[str] = Field(default=None, description="New description")


class RenderTemplateRequest(BaseModel):
    """Request to render template."""
    template_id: str = Field(..., description="Template identifier")
    values: Dict[str, Any] = Field(..., description="Variable values")


class CreateABTestRequest(BaseModel):
    """Request to create A/B test."""
    test_id: str = Field(..., description="Unique test identifier")
    prompt_a_id: str = Field(..., description="Prompt A identifier")
    prompt_b_id: str = Field(..., description="Prompt B identifier")
    split: float = Field(default=0.50, ge=0.01, le=0.99, description="Traffic split")


class UpdateMetricsRequest(BaseModel):
    """Request to update test metrics."""
    test_id: str = Field(..., description="Test identifier")
    variant: str = Field(..., description="Variant (a or b)")
    success: bool = Field(..., description="Execution success")
    latency: float = Field(..., description="Latency in milliseconds")
    score: Optional[float] = Field(default=None, ge=0, le=100, description="Quality score")


class RecordExecutionRequest(BaseModel):
    """Request to record prompt execution."""
    prompt_id: str = Field(..., description="Prompt identifier")
    success: bool = Field(..., description="Execution success")
    latency: float = Field(..., description="Latency in milliseconds")
    version: Optional[int] = Field(default=None, description="Version number")
    execution_id: Optional[str] = Field(default=None, description="Execution ID")
    score: Optional[float] = Field(default=None, ge=0, le=100, description="Quality score")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")


class OptimizeRequest(BaseModel):
    """Request to optimize prompt."""
    prompt_id: str = Field(..., description="Prompt identifier")
    auto_activate: bool = Field(default=False, description="Auto-activate best version")


# ============================================================================
# Version Management Endpoints
# ============================================================================

@router.post("/versions")
async def create_version(
    request: CreateVersionRequest,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Create new prompt version."""
    try:
        manager = PromptVersionManager(supabase)
        version = await manager.create_version(
            prompt_id=request.prompt_id,
            content=request.content,
            system_prompt=request.system_prompt,
            metadata=request.metadata,
            user_id=user_id
        )
        return {"success": True, "version": version.to_dict()}

    except Exception as e:
        logger.error("create_version_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/versions/{prompt_id}")
async def list_versions(
    prompt_id: str,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """List all versions for prompt."""
    try:
        manager = PromptVersionManager(supabase)
        versions = await manager.list_versions(prompt_id)
        return {
            "success": True,
            "prompt_id": prompt_id,
            "versions": [v.to_dict() for v in versions]
        }

    except Exception as e:
        logger.error("list_versions_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/versions/{prompt_id}/{version}")
async def get_version(
    prompt_id: str,
    version: int,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get specific prompt version."""
    try:
        manager = PromptVersionManager(supabase)
        prompt_version = await manager.get_version(prompt_id, version)

        if not prompt_version:
            raise HTTPException(status_code=404, detail="Version not found")

        return {"success": True, "version": prompt_version.to_dict()}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_version_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/versions/{prompt_id}/active")
async def get_active_version(
    prompt_id: str,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get active prompt version."""
    try:
        manager = PromptVersionManager(supabase)
        version = await manager.get_active_version(prompt_id)

        if not version:
            raise HTTPException(status_code=404, detail="No active version found")

        return {"success": True, "version": version.to_dict()}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_active_version_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/versions/activate")
async def activate_version(
    request: ActivateVersionRequest,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Activate specific prompt version."""
    try:
        manager = PromptVersionManager(supabase)
        success = await manager.activate_version(
            prompt_id=request.prompt_id,
            version=request.version,
            user_id=user_id
        )

        if not success:
            raise HTTPException(status_code=404, detail="Version not found")

        return {"success": True, "activated_version": request.version}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("activate_version_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Template Management Endpoints
# ============================================================================

@router.post("/templates")
async def create_template(
    request: CreateTemplateRequest,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Create new prompt template."""
    try:
        system = PromptTemplateSystem(supabase)
        template = await system.create_template(
            template_id=request.template_id,
            name=request.name,
            template=request.template,
            description=request.description,
            user_id=user_id
        )
        return {"success": True, "template": template.to_dict()}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("create_template_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates")
async def list_templates(
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """List all prompt templates."""
    try:
        system = PromptTemplateSystem(supabase)
        templates = await system.list_templates()
        return {
            "success": True,
            "templates": [t.to_dict() for t in templates]
        }

    except Exception as e:
        logger.error("list_templates_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates/{template_id}")
async def get_template(
    template_id: str,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get specific prompt template."""
    try:
        system = PromptTemplateSystem(supabase)
        template = await system.get_template(template_id)

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        return {"success": True, "template": template.to_dict()}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_template_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    request: UpdateTemplateRequest,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Update prompt template."""
    try:
        system = PromptTemplateSystem(supabase)
        template = await system.update_template(
            template_id=template_id,
            name=request.name,
            template=request.template,
            description=request.description,
            user_id=user_id
        )

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        return {"success": True, "template": template.to_dict()}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("update_template_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Delete prompt template."""
    try:
        system = PromptTemplateSystem(supabase)
        success = await system.delete_template(template_id, user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Template not found")

        return {"success": True, "deleted": template_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("delete_template_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates/render")
async def render_template(
    request: RenderTemplateRequest,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Render template with values."""
    try:
        system = PromptTemplateSystem(supabase)
        rendered = await system.render_template(request.template_id, request.values)

        if rendered is None:
            raise HTTPException(status_code=404, detail="Template not found")

        return {"success": True, "rendered": rendered}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("render_template_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# A/B Testing Endpoints
# ============================================================================

@router.post("/ab-tests")
async def create_ab_test(
    request: CreateABTestRequest,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Create new A/B test."""
    try:
        framework = ABTestingFramework(supabase)
        test = await framework.create_test(
            test_id=request.test_id,
            prompt_a_id=request.prompt_a_id,
            prompt_b_id=request.prompt_b_id,
            split=request.split,
            user_id=user_id
        )
        return {"success": True, "test": test.to_dict()}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("create_ab_test_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ab-tests")
async def list_ab_tests(
    status: Optional[str] = Query(default=None, description="Filter by status"),
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """List A/B tests."""
    try:
        framework = ABTestingFramework(supabase)
        tests = await framework.list_tests(status)
        return {
            "success": True,
            "tests": [t.to_dict() for t in tests]
        }

    except Exception as e:
        logger.error("list_ab_tests_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ab-tests/{test_id}")
async def get_ab_test(
    test_id: str,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get A/B test details."""
    try:
        framework = ABTestingFramework(supabase)
        test = await framework.get_test(test_id)

        if not test:
            raise HTTPException(status_code=404, detail="Test not found")

        return {"success": True, "test": test.to_dict()}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_ab_test_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ab-tests/{test_id}/results")
async def get_ab_test_results(
    test_id: str,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get A/B test results."""
    try:
        framework = ABTestingFramework(supabase)
        results = await framework.get_test_results(test_id)

        if not results:
            raise HTTPException(status_code=404, detail="Test not found")

        return {"success": True, "results": results}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_ab_test_results_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ab-tests/{test_id}/complete")
async def complete_ab_test(
    test_id: str,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Complete A/B test and determine winner."""
    try:
        framework = ABTestingFramework(supabase)
        winner = await framework.complete_test(test_id, user_id)

        if winner is None:
            raise HTTPException(status_code=404, detail="Test not found")

        return {"success": True, "winner": winner}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("complete_ab_test_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Metrics Endpoints
# ============================================================================

@router.post("/metrics/record")
async def record_execution(
    request: RecordExecutionRequest,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Record prompt execution metrics."""
    try:
        tracker = MetricsTracker(supabase)
        success = await tracker.record_execution(
            prompt_id=request.prompt_id,
            success=request.success,
            latency=request.latency,
            version=request.version,
            execution_id=request.execution_id,
            score=request.score,
            metadata=request.metadata
        )

        return {"success": success}

    except Exception as e:
        logger.error("record_execution_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/{prompt_id}")
async def get_metrics(
    prompt_id: str,
    version: Optional[int] = Query(default=None, description="Version number"),
    days: int = Query(default=30, ge=1, le=365, description="Number of days"),
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get aggregated metrics for prompt."""
    try:
        tracker = MetricsTracker(supabase)
        metrics = await tracker.get_metrics(prompt_id, version, days)

        if not metrics:
            raise HTTPException(status_code=404, detail="No metrics found")

        return {"success": True, "metrics": metrics.to_dict()}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_metrics_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/{prompt_id}/history")
async def get_metrics_history(
    prompt_id: str,
    version: Optional[int] = Query(default=None, description="Version number"),
    days: int = Query(default=30, ge=1, le=365, description="Number of days"),
    granularity: str = Query(default="daily", regex="^(hourly|daily)$"),
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get metrics history over time."""
    try:
        tracker = MetricsTracker(supabase)
        history = await tracker.get_metrics_history(prompt_id, version, days, granularity)

        return {"success": True, "history": history}

    except Exception as e:
        logger.error("get_metrics_history_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/top")
async def get_top_prompts(
    limit: int = Query(default=10, ge=1, le=100),
    days: int = Query(default=30, ge=1, le=365),
    order_by: str = Query(default="success_rate", regex="^(success_rate|avg_latency|avg_score)$"),
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get top performing prompts."""
    try:
        tracker = MetricsTracker(supabase)
        top_prompts = await tracker.get_top_prompts(limit, days, order_by)

        return {"success": True, "prompts": top_prompts}

    except Exception as e:
        logger.error("get_top_prompts_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Optimization Endpoints
# ============================================================================

@router.get("/optimize/{prompt_id}/analyze")
async def analyze_performance(
    prompt_id: str,
    days: int = Query(default=30, ge=1, le=365),
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Analyze prompt performance."""
    try:
        optimizer = PromptOptimizer(supabase)
        analysis = await optimizer.analyze_performance(prompt_id, days)

        return {"success": True, "analysis": analysis}

    except Exception as e:
        logger.error("analyze_performance_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/optimize/{prompt_id}/recommendations")
async def get_recommendations(
    prompt_id: str,
    days: int = Query(default=30, ge=1, le=365),
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get optimization recommendations."""
    try:
        optimizer = PromptOptimizer(supabase)
        recommendations = await optimizer.get_recommendations(prompt_id, days)

        return {
            "success": True,
            "recommendations": [r.to_dict() for r in recommendations]
        }

    except Exception as e:
        logger.error("get_recommendations_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/optimize")
async def auto_optimize(
    request: OptimizeRequest,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Auto-optimize prompt based on performance."""
    try:
        optimizer = PromptOptimizer(supabase)
        results = await optimizer.auto_optimize(
            prompt_id=request.prompt_id,
            auto_activate=request.auto_activate,
            user_id=user_id
        )

        return {"success": True, "results": results}

    except Exception as e:
        logger.error("auto_optimize_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/optimize/{prompt_id}/optimal")
async def get_optimal_prompt(
    prompt_id: str,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get optimal prompt version."""
    try:
        optimizer = PromptOptimizer(supabase)
        version = await optimizer.get_optimal_prompt(prompt_id)

        if not version:
            raise HTTPException(status_code=404, detail="No version found")

        return {"success": True, "version": version.to_dict()}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_optimal_prompt_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
