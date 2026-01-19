"""
Prompt Optimizer

Production-grade prompt optimization with intelligent selection,
performance-based recommendations, and automated improvements.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from supabase import Client
import structlog

from .version_manager import PromptVersionManager, PromptVersion
from .ab_testing import ABTestingFramework, ABTest
from .metrics import MetricsTracker, PromptMetrics

logger = structlog.get_logger()


class OptimizationRecommendation:
    """Represents an optimization recommendation."""

    def __init__(
        self,
        prompt_id: str,
        recommendation_type: str,
        current_version: Optional[int],
        suggested_version: Optional[int],
        confidence: str,
        reason: str,
        metrics: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize optimization recommendation.

        Args:
            prompt_id: Prompt identifier
            recommendation_type: Type of recommendation
            current_version: Current version
            suggested_version: Suggested version
            confidence: Confidence level (low/medium/high)
            reason: Explanation
            metrics: Supporting metrics
        """
        self.prompt_id = prompt_id
        self.recommendation_type = recommendation_type
        self.current_version = current_version
        self.suggested_version = suggested_version
        self.confidence = confidence
        self.reason = reason
        self.metrics = metrics or {}
        self.created_at = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "prompt_id": self.prompt_id,
            "recommendation_type": self.recommendation_type,
            "current_version": self.current_version,
            "suggested_version": self.suggested_version,
            "confidence": self.confidence,
            "reason": self.reason,
            "metrics": self.metrics,
            "created_at": self.created_at
        }


class PromptOptimizer:
    """
    Intelligent prompt optimization system.

    Integrates version management, A/B testing, and metrics
    to provide intelligent prompt selection and optimization.
    """

    def __init__(self, supabase: Client):
        """
        Initialize prompt optimizer.

        Args:
            supabase: Supabase client for persistence
        """
        self.supabase = supabase
        self.version_manager = PromptVersionManager(supabase)
        self.ab_testing = ABTestingFramework(supabase)
        self.metrics_tracker = MetricsTracker(supabase)

    async def get_optimal_prompt(
        self,
        prompt_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[PromptVersion]:
        """
        Get optimal prompt version based on performance.

        Strategy:
        1. Check for active A/B test - use variant assignment
        2. Fall back to active version
        3. Fall back to latest version

        Args:
            prompt_id: Prompt identifier
            context: Execution context (optional, for future context-aware selection)

        Returns:
            Optimal prompt version
        """
        # Check for running A/B test
        tests = await self.ab_testing.list_tests(status="running")
        for test in tests:
            if test.prompt_a_id == prompt_id or test.prompt_b_id == prompt_id:
                # Participating in A/B test
                variant, selected_prompt_id = await self.ab_testing.assign_variant(test.test_id)
                if selected_prompt_id == prompt_id:
                    # Get the version being tested
                    # For now, return active version
                    logger.info(
                        "prompt_selected_ab_test",
                        prompt_id=prompt_id,
                        test_id=test.test_id,
                        variant=variant
                    )
                    break

        # Get active version
        active_version = await self.version_manager.get_active_version(prompt_id)
        if active_version:
            return active_version

        # Fall back to latest version
        latest_version = await self.version_manager.get_version(prompt_id)
        if latest_version:
            logger.warning(
                "no_active_version_using_latest",
                prompt_id=prompt_id,
                version=latest_version.version
            )

        return latest_version

    async def analyze_performance(
        self,
        prompt_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Analyze prompt performance across versions.

        Args:
            prompt_id: Prompt identifier
            days: Number of days to analyze

        Returns:
            Performance analysis
        """
        # Get all versions
        versions = await self.version_manager.list_versions(prompt_id)

        if not versions:
            return {
                "prompt_id": prompt_id,
                "error": "No versions found"
            }

        # Get metrics for each version
        version_metrics = []
        for version in versions:
            metrics = await self.metrics_tracker.get_metrics(
                prompt_id,
                version.version,
                days
            )
            if metrics and metrics.count > 0:
                version_metrics.append({
                    "version": version.version,
                    "status": version.status.value,
                    "metrics": metrics.to_dict()
                })

        if not version_metrics:
            return {
                "prompt_id": prompt_id,
                "versions": len(versions),
                "error": "No metrics data available"
            }

        # Find best performing version
        best_version = max(
            version_metrics,
            key=lambda v: (
                v["metrics"]["success_rate"],
                -v["metrics"]["avg_latency"],
                v["metrics"]["avg_score"] or 0
            )
        )

        # Calculate overall stats
        total_executions = sum(v["metrics"]["count"] for v in version_metrics)
        avg_success_rate = sum(
            v["metrics"]["success_rate"] * v["metrics"]["count"]
            for v in version_metrics
        ) / total_executions if total_executions > 0 else 0

        return {
            "prompt_id": prompt_id,
            "total_versions": len(versions),
            "active_versions": len([v for v in versions if v.status.value == "active"]),
            "total_executions": total_executions,
            "avg_success_rate": avg_success_rate,
            "best_version": best_version,
            "version_metrics": version_metrics,
            "analysis_period_days": days
        }

    async def get_recommendations(
        self,
        prompt_id: str,
        days: int = 30
    ) -> List[OptimizationRecommendation]:
        """
        Get optimization recommendations for prompt.

        Args:
            prompt_id: Prompt identifier
            days: Number of days to analyze

        Returns:
            List of recommendations
        """
        recommendations = []

        # Analyze performance
        analysis = await self.analyze_performance(prompt_id, days)

        if "error" in analysis:
            return recommendations

        # Get current active version
        active_version = await self.version_manager.get_active_version(prompt_id)

        # Recommendation 1: Version upgrade if better version exists
        if active_version and "best_version" in analysis:
            best = analysis["best_version"]
            if best["version"] != active_version.version:
                best_metrics = best["metrics"]
                active_metrics = await self.metrics_tracker.get_metrics(
                    prompt_id,
                    active_version.version,
                    days
                )

                if active_metrics:
                    improvement = best_metrics["success_rate"] - active_metrics.success_rate

                    if improvement > 0.05:  # 5% improvement
                        recommendations.append(OptimizationRecommendation(
                            prompt_id=prompt_id,
                            recommendation_type="version_upgrade",
                            current_version=active_version.version,
                            suggested_version=best["version"],
                            confidence="high" if improvement > 0.10 else "medium",
                            reason=f"Version {best['version']} shows {improvement:.1%} higher success rate",
                            metrics={
                                "current": active_metrics.to_dict(),
                                "suggested": best_metrics
                            }
                        ))

        # Recommendation 2: A/B test for new versions
        versions = await self.version_manager.list_versions(prompt_id)
        draft_versions = [v for v in versions if v.status.value == "draft"]

        if draft_versions and active_version:
            recommendations.append(OptimizationRecommendation(
                prompt_id=prompt_id,
                recommendation_type="ab_test",
                current_version=active_version.version,
                suggested_version=draft_versions[0].version,
                confidence="medium",
                reason=f"Test {len(draft_versions)} draft version(s) against active version",
                metrics={
                    "draft_versions": [v.version for v in draft_versions]
                }
            ))

        # Recommendation 3: Deprecate underperforming versions
        if "version_metrics" in analysis:
            for vm in analysis["version_metrics"]:
                if vm["metrics"]["count"] >= 30:  # Minimum sample size
                    if vm["metrics"]["success_rate"] < 0.70:  # Below 70% success
                        version_obj = next(
                            (v for v in versions if v.version == vm["version"]),
                            None
                        )
                        if version_obj and version_obj.status.value == "active":
                            recommendations.append(OptimizationRecommendation(
                                prompt_id=prompt_id,
                                recommendation_type="deprecate_version",
                                current_version=vm["version"],
                                suggested_version=None,
                                confidence="high",
                                reason=f"Version {vm['version']} has low success rate ({vm['metrics']['success_rate']:.1%})",
                                metrics=vm["metrics"]
                            ))

        # Recommendation 4: Performance degradation alert
        if active_version:
            metrics_7d = await self.metrics_tracker.get_metrics(prompt_id, active_version.version, 7)
            metrics_30d = await self.metrics_tracker.get_metrics(prompt_id, active_version.version, 30)

            if metrics_7d and metrics_30d:
                degradation = metrics_30d.success_rate - metrics_7d.success_rate
                if degradation > 0.10:  # 10% degradation
                    recommendations.append(OptimizationRecommendation(
                        prompt_id=prompt_id,
                        recommendation_type="performance_alert",
                        current_version=active_version.version,
                        suggested_version=None,
                        confidence="high",
                        reason=f"Performance degraded {degradation:.1%} in last 7 days",
                        metrics={
                            "7_day": metrics_7d.to_dict(),
                            "30_day": metrics_30d.to_dict()
                        }
                    ))

        return recommendations

    async def auto_optimize(
        self,
        prompt_id: str,
        auto_activate: bool = False,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Automatically optimize prompt based on performance.

        Args:
            prompt_id: Prompt identifier
            auto_activate: Whether to auto-activate best version
            user_id: User performing optimization

        Returns:
            Optimization results
        """
        results = {
            "prompt_id": prompt_id,
            "actions_taken": [],
            "recommendations": []
        }

        # Get recommendations
        recommendations = await self.get_recommendations(prompt_id)
        results["recommendations"] = [r.to_dict() for r in recommendations]

        # Auto-activate best version if enabled
        if auto_activate:
            version_upgrade = next(
                (r for r in recommendations if r.recommendation_type == "version_upgrade" and r.confidence == "high"),
                None
            )

            if version_upgrade:
                success = await self.version_manager.activate_version(
                    prompt_id,
                    version_upgrade.suggested_version,
                    user_id
                )

                if success:
                    results["actions_taken"].append({
                        "action": "version_activated",
                        "version": version_upgrade.suggested_version,
                        "reason": version_upgrade.reason
                    })

                    logger.info(
                        "auto_optimization_activated_version",
                        prompt_id=prompt_id,
                        version=version_upgrade.suggested_version,
                        user_id=user_id
                    )

        return results

    async def create_optimization_test(
        self,
        prompt_id: str,
        new_version_content: str,
        new_version_system_prompt: str,
        test_duration_hours: int = 24,
        user_id: Optional[str] = None
    ) -> Optional[ABTest]:
        """
        Create A/B test for prompt optimization.

        Args:
            prompt_id: Prompt identifier
            new_version_content: New version content to test
            new_version_system_prompt: New system prompt
            test_duration_hours: Test duration in hours
            user_id: User creating the test

        Returns:
            Created A/B test or None if failed
        """
        # Get current active version
        active_version = await self.version_manager.get_active_version(prompt_id)
        if not active_version:
            logger.error("no_active_version_for_test", prompt_id=prompt_id)
            return None

        # Create new draft version
        new_version = await self.version_manager.create_version(
            prompt_id=prompt_id,
            content=new_version_content,
            system_prompt=new_version_system_prompt,
            metadata={"created_for": "ab_test"},
            user_id=user_id
        )

        # Create A/B test
        test_id = f"{prompt_id}_v{active_version.version}_vs_v{new_version.version}"

        test = await self.ab_testing.create_test(
            test_id=test_id,
            prompt_a_id=f"{prompt_id}:v{active_version.version}",
            prompt_b_id=f"{prompt_id}:v{new_version.version}",
            split=0.50,
            user_id=user_id
        )

        # Start test
        await self.ab_testing.start_test(test_id, user_id)

        logger.info(
            "optimization_test_created",
            prompt_id=prompt_id,
            test_id=test_id,
            version_a=active_version.version,
            version_b=new_version.version,
            user_id=user_id
        )

        return test
