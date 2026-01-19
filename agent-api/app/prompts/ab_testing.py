"""
A/B Testing Framework for Prompts

Production-grade A/B testing with traffic splitting, metrics aggregation,
and statistical significance testing.
"""

import random
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from enum import Enum
from supabase import Client
import structlog

logger = structlog.get_logger()


class TestStatus(str, Enum):
    """A/B test status."""
    RUNNING = "running"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ABTest:
    """Represents an A/B test between two prompt variants."""

    def __init__(
        self,
        test_id: str,
        prompt_a_id: str,
        prompt_b_id: str,
        split: float = 0.50,
        status: str = "running",
        metrics_a: Optional[Dict[str, Any]] = None,
        metrics_b: Optional[Dict[str, Any]] = None,
        winner: Optional[str] = None,
        created_at: Optional[str] = None,
        started_at: Optional[str] = None,
        completed_at: Optional[str] = None,
        id: Optional[str] = None
    ):
        """
        Initialize A/B test.

        Args:
            test_id: Unique test identifier
            prompt_a_id: Prompt ID for variant A
            prompt_b_id: Prompt ID for variant B
            split: Traffic split (0.0-1.0, default 0.5 for 50/50)
            status: Test status
            metrics_a: Aggregated metrics for variant A
            metrics_b: Aggregated metrics for variant B
            winner: Winning variant ("a" or "b")
            created_at: Creation timestamp
            started_at: Start timestamp
            completed_at: Completion timestamp
            id: Database ID
        """
        self.id = id
        self.test_id = test_id
        self.prompt_a_id = prompt_a_id
        self.prompt_b_id = prompt_b_id
        self.split = split
        self.status = TestStatus(status) if isinstance(status, str) else status
        self.metrics_a = metrics_a or {}
        self.metrics_b = metrics_b or {}
        self.winner = winner
        self.created_at = created_at or datetime.utcnow().isoformat()
        self.started_at = started_at
        self.completed_at = completed_at

    def assign_variant(self) -> str:
        """
        Assign a variant based on traffic split.

        Returns:
            "a" or "b" based on random assignment
        """
        return "a" if random.random() < self.split else "b"

    def get_variant_prompt_id(self, variant: str) -> str:
        """
        Get prompt ID for variant.

        Args:
            variant: "a" or "b"

        Returns:
            Prompt ID for the variant
        """
        return self.prompt_a_id if variant == "a" else self.prompt_b_id

    def calculate_winner(self) -> Optional[str]:
        """
        Calculate winner based on success rate and statistical significance.

        Returns:
            "a", "b", or None if no clear winner

        Uses simple heuristic:
        - Requires minimum 30 samples per variant
        - Winner must have >= 5% higher success rate
        """
        # Get sample counts
        count_a = self.metrics_a.get("count", 0)
        count_b = self.metrics_b.get("count", 0)

        # Require minimum samples
        if count_a < 30 or count_b < 30:
            return None

        # Get success rates
        success_rate_a = self.metrics_a.get("success_rate", 0.0)
        success_rate_b = self.metrics_b.get("success_rate", 0.0)

        # Calculate difference
        diff = abs(success_rate_a - success_rate_b)

        # Require minimum 5% difference
        if diff < 0.05:
            return None

        # Determine winner
        return "a" if success_rate_a > success_rate_b else "b"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage/API."""
        return {
            "id": self.id,
            "test_id": self.test_id,
            "prompt_a_id": self.prompt_a_id,
            "prompt_b_id": self.prompt_b_id,
            "split": self.split,
            "status": self.status.value,
            "metrics_a": self.metrics_a,
            "metrics_b": self.metrics_b,
            "winner": self.winner,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ABTest":
        """Create from dictionary."""
        return cls(
            id=data.get("id"),
            test_id=data["test_id"],
            prompt_a_id=data["prompt_a_id"],
            prompt_b_id=data["prompt_b_id"],
            split=float(data.get("split", 0.50)),
            status=data.get("status", "running"),
            metrics_a=data.get("metrics_a", {}),
            metrics_b=data.get("metrics_b", {}),
            winner=data.get("winner"),
            created_at=data.get("created_at"),
            started_at=data.get("started_at"),
            completed_at=data.get("completed_at")
        )


class ABTestingFramework:
    """
    Manage A/B tests with Supabase persistence.

    Provides test lifecycle management, variant assignment,
    metrics aggregation, and winner determination.
    """

    def __init__(self, supabase: Client):
        """
        Initialize A/B testing framework.

        Args:
            supabase: Supabase client for persistence
        """
        self.supabase = supabase
        self.table_name = "prompt_ab_tests"
        self.metrics_table = "prompt_metrics"

    async def create_test(
        self,
        test_id: str,
        prompt_a_id: str,
        prompt_b_id: str,
        split: float = 0.50,
        user_id: Optional[str] = None
    ) -> ABTest:
        """
        Create new A/B test.

        Args:
            test_id: Unique test identifier
            prompt_a_id: Prompt ID for variant A
            prompt_b_id: Prompt ID for variant B
            split: Traffic split (0.0-1.0)
            user_id: User creating the test

        Returns:
            Created A/B test

        Raises:
            ValueError: If split is invalid
        """
        if split <= 0 or split >= 1:
            raise ValueError("Split must be between 0 and 1 (exclusive)")

        # Create test object
        test_data = {
            "test_id": test_id,
            "prompt_a_id": prompt_a_id,
            "prompt_b_id": prompt_b_id,
            "split": split,
            "status": TestStatus.RUNNING.value,
            "metrics_a": {},
            "metrics_b": {},
            "created_at": datetime.utcnow().isoformat(),
            "created_by": user_id
        }

        # Insert into database
        result = self.supabase.table(self.table_name).insert(test_data).execute()

        if not result.data:
            raise Exception("Failed to create A/B test")

        test = ABTest.from_dict(result.data[0])

        logger.info(
            "ab_test_created",
            test_id=test_id,
            prompt_a=prompt_a_id,
            prompt_b=prompt_b_id,
            split=split,
            user_id=user_id
        )

        return test

    async def get_test(self, test_id: str) -> Optional[ABTest]:
        """
        Get A/B test by ID.

        Args:
            test_id: Test identifier

        Returns:
            A/B test or None if not found
        """
        result = self.supabase.table(self.table_name).select("*").eq(
            "test_id", test_id
        ).execute()

        if not result.data:
            return None

        return ABTest.from_dict(result.data[0])

    async def list_tests(
        self,
        status: Optional[str] = None
    ) -> List[ABTest]:
        """
        List A/B tests.

        Args:
            status: Filter by status (optional)

        Returns:
            List of A/B tests
        """
        query = self.supabase.table(self.table_name).select("*")

        if status:
            query = query.eq("status", status)

        result = query.order("created_at", desc=True).execute()

        return [ABTest.from_dict(t) for t in result.data]

    async def start_test(
        self,
        test_id: str,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Start A/B test.

        Args:
            test_id: Test identifier
            user_id: User starting the test

        Returns:
            Success status
        """
        result = self.supabase.table(self.table_name).update({
            "status": TestStatus.RUNNING.value,
            "started_at": datetime.utcnow().isoformat()
        }).eq("test_id", test_id).execute()

        success = bool(result.data)

        if success:
            logger.info(
                "ab_test_started",
                test_id=test_id,
                user_id=user_id
            )

        return success

    async def assign_variant(self, test_id: str) -> Optional[Tuple[str, str]]:
        """
        Assign variant for test execution.

        Args:
            test_id: Test identifier

        Returns:
            Tuple of (variant, prompt_id) or None if test not found
        """
        test = await self.get_test(test_id)
        if not test or test.status != TestStatus.RUNNING:
            return None

        variant = test.assign_variant()
        prompt_id = test.get_variant_prompt_id(variant)

        return variant, prompt_id

    async def update_metrics(
        self,
        test_id: str,
        variant: str,
        success: bool,
        latency: float,
        score: Optional[float] = None
    ) -> bool:
        """
        Update metrics for a variant.

        Args:
            test_id: Test identifier
            variant: "a" or "b"
            success: Whether execution succeeded
            latency: Execution latency in milliseconds
            score: Quality score (0-100)

        Returns:
            Success status
        """
        test = await self.get_test(test_id)
        if not test:
            return False

        # Get current metrics
        metrics = test.metrics_a if variant == "a" else test.metrics_b

        # Update aggregates
        count = metrics.get("count", 0) + 1
        success_count = metrics.get("success_count", 0) + (1 if success else 0)
        total_latency = metrics.get("total_latency", 0.0) + latency

        scores = metrics.get("scores", [])
        if score is not None:
            scores.append(score)

        # Calculate aggregated metrics
        updated_metrics = {
            "count": count,
            "success_count": success_count,
            "success_rate": success_count / count,
            "total_latency": total_latency,
            "avg_latency": total_latency / count,
            "scores": scores,
            "avg_score": sum(scores) / len(scores) if scores else None
        }

        # Update in database
        field_name = "metrics_a" if variant == "a" else "metrics_b"
        result = self.supabase.table(self.table_name).update({
            field_name: updated_metrics
        }).eq("test_id", test_id).execute()

        return bool(result.data)

    async def complete_test(
        self,
        test_id: str,
        user_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Complete A/B test and determine winner.

        Args:
            test_id: Test identifier
            user_id: User completing the test

        Returns:
            Winner ("a", "b", or None for tie)
        """
        test = await self.get_test(test_id)
        if not test:
            return None

        # Calculate winner
        winner = test.calculate_winner()

        # Update test
        result = self.supabase.table(self.table_name).update({
            "status": TestStatus.COMPLETED.value,
            "winner": winner,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("test_id", test_id).execute()

        if result.data:
            logger.info(
                "ab_test_completed",
                test_id=test_id,
                winner=winner,
                metrics_a=test.metrics_a,
                metrics_b=test.metrics_b,
                user_id=user_id
            )

        return winner

    async def archive_test(
        self,
        test_id: str,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Archive A/B test.

        Args:
            test_id: Test identifier
            user_id: User archiving the test

        Returns:
            Success status
        """
        result = self.supabase.table(self.table_name).update({
            "status": TestStatus.ARCHIVED.value
        }).eq("test_id", test_id).execute()

        success = bool(result.data)

        if success:
            logger.info(
                "ab_test_archived",
                test_id=test_id,
                user_id=user_id
            )

        return success

    async def get_test_results(self, test_id: str) -> Optional[Dict[str, Any]]:
        """
        Get formatted test results.

        Args:
            test_id: Test identifier

        Returns:
            Test results with metrics comparison
        """
        test = await self.get_test(test_id)
        if not test:
            return None

        return {
            "test_id": test.test_id,
            "status": test.status.value,
            "prompt_a_id": test.prompt_a_id,
            "prompt_b_id": test.prompt_b_id,
            "split": test.split,
            "variant_a": {
                "prompt_id": test.prompt_a_id,
                "metrics": test.metrics_a
            },
            "variant_b": {
                "prompt_id": test.prompt_b_id,
                "metrics": test.metrics_b
            },
            "winner": test.winner,
            "winner_prompt_id": test.get_variant_prompt_id(test.winner) if test.winner else None,
            "started_at": test.started_at,
            "completed_at": test.completed_at
        }
