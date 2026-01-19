"""
Metrics Tracker for Prompt Performance

Production-grade metrics collection, aggregation, and analysis
for prompt performance monitoring.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from supabase import Client
import structlog

logger = structlog.get_logger()


class PromptMetrics:
    """Aggregated metrics for a prompt."""

    def __init__(
        self,
        prompt_id: str,
        version: Optional[int] = None,
        count: int = 0,
        success_count: int = 0,
        success_rate: float = 0.0,
        avg_latency: float = 0.0,
        min_latency: float = 0.0,
        max_latency: float = 0.0,
        avg_score: Optional[float] = None,
        min_score: Optional[float] = None,
        max_score: Optional[float] = None
    ):
        """
        Initialize prompt metrics.

        Args:
            prompt_id: Prompt identifier
            version: Prompt version (optional)
            count: Total execution count
            success_count: Successful execution count
            success_rate: Success rate (0.0-1.0)
            avg_latency: Average latency in milliseconds
            min_latency: Minimum latency
            max_latency: Maximum latency
            avg_score: Average quality score (0-100)
            min_score: Minimum score
            max_score: Maximum score
        """
        self.prompt_id = prompt_id
        self.version = version
        self.count = count
        self.success_count = success_count
        self.success_rate = success_rate
        self.avg_latency = avg_latency
        self.min_latency = min_latency
        self.max_latency = max_latency
        self.avg_score = avg_score
        self.min_score = min_score
        self.max_score = max_score

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "prompt_id": self.prompt_id,
            "version": self.version,
            "count": self.count,
            "success_count": self.success_count,
            "success_rate": self.success_rate,
            "avg_latency": self.avg_latency,
            "min_latency": self.min_latency,
            "max_latency": self.max_latency,
            "avg_score": self.avg_score,
            "min_score": self.min_score,
            "max_score": self.max_score
        }


class MetricsTracker:
    """
    Track and aggregate prompt execution metrics.

    Provides metrics persistence, aggregation, and analysis
    for prompt performance monitoring.
    """

    def __init__(self, supabase: Client):
        """
        Initialize metrics tracker.

        Args:
            supabase: Supabase client for persistence
        """
        self.supabase = supabase
        self.table_name = "prompt_metrics"

    async def record_execution(
        self,
        prompt_id: str,
        success: bool,
        latency: float,
        version: Optional[int] = None,
        execution_id: Optional[str] = None,
        score: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Record prompt execution metrics.

        Args:
            prompt_id: Prompt identifier
            success: Whether execution succeeded
            latency: Execution latency in milliseconds
            version: Prompt version (optional)
            execution_id: Unique execution ID (optional)
            score: Quality score 0-100 (optional)
            metadata: Additional metadata (optional)

        Returns:
            Success status
        """
        metric_data = {
            "prompt_id": prompt_id,
            "version": version,
            "execution_id": execution_id,
            "success": success,
            "latency": latency,
            "score": score,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat()
        }

        try:
            result = self.supabase.table(self.table_name).insert(metric_data).execute()

            if result.data:
                logger.info(
                    "prompt_execution_recorded",
                    prompt_id=prompt_id,
                    version=version,
                    success=success,
                    latency=latency,
                    score=score
                )
                return True

        except Exception as e:
            logger.error(
                "failed_to_record_metrics",
                prompt_id=prompt_id,
                error=str(e)
            )

        return False

    async def get_metrics(
        self,
        prompt_id: str,
        version: Optional[int] = None,
        days: int = 30
    ) -> Optional[PromptMetrics]:
        """
        Get aggregated metrics for prompt.

        Args:
            prompt_id: Prompt identifier
            version: Prompt version (optional, None = all versions)
            days: Number of days to include (default 30)

        Returns:
            Aggregated metrics or None if no data
        """
        # Calculate date threshold
        since = (datetime.utcnow() - timedelta(days=days)).isoformat()

        # Build query
        query = self.supabase.table(self.table_name).select("*").eq(
            "prompt_id", prompt_id
        ).gte("created_at", since)

        if version is not None:
            query = query.eq("version", version)

        result = query.execute()

        if not result.data:
            return None

        # Aggregate metrics
        records = result.data
        count = len(records)
        success_count = sum(1 for r in records if r["success"])
        success_rate = success_count / count if count > 0 else 0.0

        latencies = [r["latency"] for r in records]
        avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
        min_latency = min(latencies) if latencies else 0.0
        max_latency = max(latencies) if latencies else 0.0

        scores = [r["score"] for r in records if r.get("score") is not None]
        avg_score = sum(scores) / len(scores) if scores else None
        min_score = min(scores) if scores else None
        max_score = max(scores) if scores else None

        return PromptMetrics(
            prompt_id=prompt_id,
            version=version,
            count=count,
            success_count=success_count,
            success_rate=success_rate,
            avg_latency=avg_latency,
            min_latency=min_latency,
            max_latency=max_latency,
            avg_score=avg_score,
            min_score=min_score,
            max_score=max_score
        )

    async def get_metrics_history(
        self,
        prompt_id: str,
        version: Optional[int] = None,
        days: int = 30,
        granularity: str = "daily"
    ) -> List[Dict[str, Any]]:
        """
        Get metrics history over time.

        Args:
            prompt_id: Prompt identifier
            version: Prompt version (optional)
            days: Number of days to include
            granularity: "hourly" or "daily"

        Returns:
            List of metrics snapshots over time
        """
        since = (datetime.utcnow() - timedelta(days=days)).isoformat()

        query = self.supabase.table(self.table_name).select("*").eq(
            "prompt_id", prompt_id
        ).gte("created_at", since)

        if version is not None:
            query = query.eq("version", version)

        result = query.order("created_at").execute()

        if not result.data:
            return []

        # Group by time buckets
        buckets = {}
        for record in result.data:
            created_at = datetime.fromisoformat(record["created_at"].replace("Z", "+00:00"))

            if granularity == "daily":
                bucket_key = created_at.date().isoformat()
            else:  # hourly
                bucket_key = created_at.replace(minute=0, second=0, microsecond=0).isoformat()

            if bucket_key not in buckets:
                buckets[bucket_key] = []

            buckets[bucket_key].append(record)

        # Aggregate each bucket
        history = []
        for bucket_key, records in sorted(buckets.items()):
            count = len(records)
            success_count = sum(1 for r in records if r["success"])
            success_rate = success_count / count if count > 0 else 0.0

            latencies = [r["latency"] for r in records]
            avg_latency = sum(latencies) / len(latencies) if latencies else 0.0

            scores = [r["score"] for r in records if r.get("score") is not None]
            avg_score = sum(scores) / len(scores) if scores else None

            history.append({
                "timestamp": bucket_key,
                "count": count,
                "success_count": success_count,
                "success_rate": success_rate,
                "avg_latency": avg_latency,
                "avg_score": avg_score
            })

        return history

    async def compare_versions(
        self,
        prompt_id: str,
        version_a: int,
        version_b: int,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Compare metrics between two versions.

        Args:
            prompt_id: Prompt identifier
            version_a: First version
            version_b: Second version
            days: Number of days to include

        Returns:
            Comparison results
        """
        metrics_a = await self.get_metrics(prompt_id, version_a, days)
        metrics_b = await self.get_metrics(prompt_id, version_b, days)

        if not metrics_a or not metrics_b:
            return {
                "error": "Insufficient data for comparison",
                "version_a": metrics_a.to_dict() if metrics_a else None,
                "version_b": metrics_b.to_dict() if metrics_b else None
            }

        # Calculate differences
        success_rate_diff = metrics_b.success_rate - metrics_a.success_rate
        latency_diff = metrics_b.avg_latency - metrics_a.avg_latency
        score_diff = None
        if metrics_a.avg_score is not None and metrics_b.avg_score is not None:
            score_diff = metrics_b.avg_score - metrics_a.avg_score

        # Determine better version
        better_version = None
        if success_rate_diff > 0.05:  # 5% improvement
            better_version = version_b
        elif success_rate_diff < -0.05:
            better_version = version_a
        elif score_diff and abs(score_diff) > 5:  # 5 point difference
            better_version = version_b if score_diff > 0 else version_a

        return {
            "prompt_id": prompt_id,
            "version_a": {
                "version": version_a,
                "metrics": metrics_a.to_dict()
            },
            "version_b": {
                "version": version_b,
                "metrics": metrics_b.to_dict()
            },
            "differences": {
                "success_rate": success_rate_diff,
                "latency": latency_diff,
                "score": score_diff
            },
            "better_version": better_version,
            "confidence": "high" if abs(success_rate_diff) > 0.10 else "medium" if abs(success_rate_diff) > 0.05 else "low"
        }

    async def get_top_prompts(
        self,
        limit: int = 10,
        days: int = 30,
        order_by: str = "success_rate"
    ) -> List[Dict[str, Any]]:
        """
        Get top performing prompts.

        Args:
            limit: Number of prompts to return
            days: Number of days to include
            order_by: "success_rate", "avg_latency", or "avg_score"

        Returns:
            List of top prompts with metrics
        """
        since = (datetime.utcnow() - timedelta(days=days)).isoformat()

        result = self.supabase.table(self.table_name).select(
            "prompt_id, version"
        ).gte("created_at", since).execute()

        if not result.data:
            return []

        # Get unique prompt/version combinations
        prompt_versions = set()
        for record in result.data:
            prompt_versions.add((record["prompt_id"], record.get("version")))

        # Get metrics for each
        metrics_list = []
        for prompt_id, version in prompt_versions:
            metrics = await self.get_metrics(prompt_id, version, days)
            if metrics and metrics.count >= 10:  # Minimum sample size
                metrics_list.append({
                    "prompt_id": prompt_id,
                    "version": version,
                    "metrics": metrics.to_dict()
                })

        # Sort by specified metric
        if order_by == "success_rate":
            metrics_list.sort(key=lambda x: x["metrics"]["success_rate"], reverse=True)
        elif order_by == "avg_latency":
            metrics_list.sort(key=lambda x: x["metrics"]["avg_latency"])
        elif order_by == "avg_score":
            metrics_list.sort(
                key=lambda x: x["metrics"]["avg_score"] or 0,
                reverse=True
            )

        return metrics_list[:limit]

    async def delete_old_metrics(self, days: int = 90) -> int:
        """
        Delete metrics older than specified days.

        Args:
            days: Delete metrics older than this many days

        Returns:
            Number of records deleted
        """
        threshold = (datetime.utcnow() - timedelta(days=days)).isoformat()

        result = self.supabase.table(self.table_name).delete().lt(
            "created_at", threshold
        ).execute()

        deleted_count = len(result.data) if result.data else 0

        logger.info(
            "old_metrics_deleted",
            threshold=threshold,
            count=deleted_count
        )

        return deleted_count
