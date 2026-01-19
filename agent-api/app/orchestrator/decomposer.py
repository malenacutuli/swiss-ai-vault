"""
Task Decomposer for Query Analysis and Subtask Generation

Implements 4 decomposition strategies:
- entity_based: Split by entities mentioned in query
- dimension_based: Split by analytical dimensions
- source_based: Split by data source types
- temporal_based: Split by time periods
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from anthropic import Anthropic

from app.orchestrator.types import (
    RunConfig,
    SubtaskDefinition,
    DecompositionResult,
    ValidationError,
    DecompositionError,
)

logger = logging.getLogger(__name__)


# =============================================================================
# PROMPTS
# =============================================================================

QUERY_VALIDATION_PROMPT = """You are a query validator for a research orchestration system.

Analyze the given query and determine if it can be decomposed into parallel research subtasks.

A valid query should:
1. Be specific enough to research
2. Be decomposable into multiple independent or semi-independent parts
3. Not be a simple factual question that can be answered in one step
4. Not contain harmful, illegal, or unethical requests

Respond with JSON:
{
    "is_valid": true/false,
    "error_message": "reason if invalid",
    "suggestions": ["improvement suggestions"],
    "estimated_subtasks": 5,
    "recommended_strategy": "entity_based|dimension_based|source_based|temporal_based"
}"""

QUERY_ANALYSIS_PROMPT = """You are a research query analyzer.

Analyze the given query to understand its structure and determine the best decomposition strategy.

Extract:
1. Entities mentioned (companies, people, products, concepts)
2. Dimensions to analyze (financial, technical, legal, market, etc.)
3. Data sources needed (web, academic, news, financial data, etc.)
4. Time periods if relevant
5. The overall research goal

Respond with JSON:
{
    "entities": ["entity1", "entity2"],
    "dimensions": ["dimension1", "dimension2"],
    "sources": ["source1", "source2"],
    "time_periods": ["period1"],
    "goal": "concise description of research goal",
    "reasoning": "explanation of analysis",
    "requires_multiple_sources": true/false,
    "complexity": "simple|moderate|complex"
}"""

ENTITY_DECOMPOSITION_PROMPT = """You are a task decomposer for research operations.

Given the query and identified entities, create subtasks that research each entity independently.

Query: {query}
Entities: {entities}
Max Subtasks: {max_subtasks}

For each subtask, specify:
- task_type: "entity_research"
- entity_id: the entity being researched
- input_data: specific research instructions
- priority: 1-10 (higher = more important)
- estimated_duration_seconds: estimate
- depends_on_indices: list of indices this depends on (empty for parallel)

Create a final "synthesis" subtask that depends on all entity research subtasks.

Respond with JSON:
{
    "subtasks": [
        {
            "task_type": "entity_research",
            "entity_id": "Entity Name",
            "input_data": {"instructions": "...", "focus_areas": [".."]},
            "priority": 5,
            "estimated_duration_seconds": 60,
            "depends_on_indices": []
        }
    ],
    "reasoning": "explanation of decomposition"
}"""

DIMENSION_DECOMPOSITION_PROMPT = """You are a task decomposer for research operations.

Given the query and identified dimensions, create subtasks that analyze each dimension.

Query: {query}
Dimensions: {dimensions}
Max Subtasks: {max_subtasks}

For each dimension, create a subtask. Include a synthesis subtask at the end.

Respond with JSON:
{
    "subtasks": [
        {
            "task_type": "dimension_analysis",
            "entity_id": null,
            "input_data": {"dimension": "...", "analysis_focus": "...", "metrics": [".."]},
            "priority": 5,
            "estimated_duration_seconds": 60,
            "depends_on_indices": []
        }
    ],
    "reasoning": "explanation of decomposition"
}"""


class TaskDecomposer:
    """
    Decomposes research queries into parallel subtasks.

    Strategies:
    - entity_based: Split by entities mentioned in query
    - dimension_based: Split by analytical dimensions
    - source_based: Split by data source types
    - temporal_based: Split by time periods
    """

    def __init__(self, anthropic: Anthropic):
        self.anthropic = anthropic

    async def validate_query(self, query: str) -> dict:
        """
        Validate that a query can be decomposed.

        Returns:
            Validation result with is_valid, error_message, suggestions
        """
        if len(query.strip()) < 10:
            return {
                "is_valid": False,
                "error_message": "Query too short",
                "suggestions": ["Provide more detail about what you want to research"],
            }

        if len(query) > 10000:
            return {
                "is_valid": False,
                "error_message": "Query too long",
                "suggestions": ["Summarize your research question"],
            }

        try:
            response = self.anthropic.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                temperature=0.3,
                system=QUERY_VALIDATION_PROMPT,
                messages=[{"role": "user", "content": query}],
            )

            content = response.content[0].text if response.content else "{}"
            result = self._extract_json(content)

            if result is None:
                return {
                    "is_valid": True,
                    "error_message": None,
                    "suggestions": [],
                }

            return result

        except Exception as e:
            logger.error(f"Query validation error: {e}")
            # Default to valid if validation fails
            return {
                "is_valid": True,
                "error_message": None,
                "suggestions": [],
            }

    async def decompose(
        self,
        query: str,
        config: RunConfig,
        max_subtasks: Optional[int] = None
    ) -> DecompositionResult:
        """
        Decompose a query into subtasks.

        Process:
        1. Analyze query to identify decomposition strategy
        2. Extract entities/dimensions
        3. Generate subtask definitions
        4. Build dependency graph
        5. Estimate resources
        """
        max_subtasks = max_subtasks or config.max_subtasks

        # Step 1: Analyze query
        analysis = await self._analyze_query(query)

        # Step 2: Select decomposition strategy
        strategy = self._select_strategy(analysis, config)
        logger.info(f"Selected decomposition strategy: {strategy}")

        # Step 3: Generate subtasks based on strategy
        if strategy == "entity_based":
            subtasks, reasoning = await self._decompose_by_entity(
                query, analysis, max_subtasks
            )
        elif strategy == "dimension_based":
            subtasks, reasoning = await self._decompose_by_dimension(
                query, analysis, max_subtasks
            )
        elif strategy == "source_based":
            subtasks, reasoning = await self._decompose_by_source(
                query, analysis, max_subtasks
            )
        else:
            subtasks, reasoning = await self._decompose_generic(
                query, analysis, max_subtasks
            )

        if not subtasks:
            raise DecompositionError("No subtasks generated")

        # Step 4: Build dependency graph
        dependencies = self._build_dependency_graph(subtasks)

        # Step 5: Estimate resources
        estimates = self._estimate_resources(subtasks)

        return DecompositionResult(
            subtasks=subtasks,
            dependency_graph=dependencies,
            estimated_duration_minutes=estimates["duration_minutes"],
            estimated_cost_usd=estimates["cost_usd"],
            decomposition_reasoning=reasoning,
        )

    async def _analyze_query(self, query: str) -> Dict[str, Any]:
        """Analyze query to understand structure and intent."""
        try:
            response = self.anthropic.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                temperature=0.3,
                system=QUERY_ANALYSIS_PROMPT,
                messages=[{"role": "user", "content": query}],
            )

            content = response.content[0].text if response.content else "{}"
            result = self._extract_json(content)

            if result is None:
                # Fallback to basic analysis
                return {
                    "entities": [],
                    "dimensions": ["general"],
                    "sources": ["web"],
                    "goal": query[:200],
                    "reasoning": "Fallback analysis",
                    "requires_multiple_sources": False,
                    "complexity": "moderate",
                }

            return result

        except Exception as e:
            logger.error(f"Query analysis error: {e}")
            return {
                "entities": [],
                "dimensions": ["general"],
                "sources": ["web"],
                "goal": query[:200],
                "reasoning": f"Analysis failed: {e}",
                "requires_multiple_sources": False,
                "complexity": "moderate",
            }

    def _select_strategy(
        self,
        analysis: Dict[str, Any],
        config: RunConfig
    ) -> str:
        """Select the best decomposition strategy."""
        # Check for explicit strategy in config
        if config.decomposition_strategy != "auto":
            return config.decomposition_strategy

        # Select based on query characteristics
        entities = analysis.get("entities", [])
        dimensions = analysis.get("dimensions", [])
        sources = analysis.get("sources", [])

        if entities and len(entities) > 1:
            return "entity_based"

        if dimensions and len(dimensions) > 1:
            return "dimension_based"

        if analysis.get("requires_multiple_sources") and len(sources) > 1:
            return "source_based"

        return "generic"

    async def _decompose_by_entity(
        self,
        query: str,
        analysis: Dict[str, Any],
        max_subtasks: int
    ) -> tuple[List[SubtaskDefinition], str]:
        """Decompose query by entities."""
        entities = analysis.get("entities", [])[:max_subtasks - 1]  # Leave room for synthesis

        if not entities:
            return await self._decompose_generic(query, analysis, max_subtasks)

        prompt = ENTITY_DECOMPOSITION_PROMPT.format(
            query=query,
            entities=json.dumps(entities),
            max_subtasks=max_subtasks,
        )

        try:
            response = self.anthropic.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                temperature=0.3,
                messages=[{"role": "user", "content": prompt}],
            )

            content = response.content[0].text if response.content else "{}"
            result = self._extract_json(content)

            if result is None or "subtasks" not in result:
                return await self._decompose_generic(query, analysis, max_subtasks)

            subtasks = [
                SubtaskDefinition(
                    task_type=s.get("task_type", "entity_research"),
                    entity_id=s.get("entity_id"),
                    input_data=s.get("input_data", {}),
                    priority=s.get("priority", 5),
                    estimated_duration_seconds=s.get("estimated_duration_seconds", 60),
                    depends_on_indices=s.get("depends_on_indices", []),
                )
                for s in result["subtasks"]
            ]

            return subtasks, result.get("reasoning", "Entity-based decomposition")

        except Exception as e:
            logger.error(f"Entity decomposition error: {e}")
            return await self._decompose_generic(query, analysis, max_subtasks)

    async def _decompose_by_dimension(
        self,
        query: str,
        analysis: Dict[str, Any],
        max_subtasks: int
    ) -> tuple[List[SubtaskDefinition], str]:
        """Decompose query by analytical dimensions."""
        dimensions = analysis.get("dimensions", [])[:max_subtasks - 1]

        if not dimensions:
            return await self._decompose_generic(query, analysis, max_subtasks)

        prompt = DIMENSION_DECOMPOSITION_PROMPT.format(
            query=query,
            dimensions=json.dumps(dimensions),
            max_subtasks=max_subtasks,
        )

        try:
            response = self.anthropic.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                temperature=0.3,
                messages=[{"role": "user", "content": prompt}],
            )

            content = response.content[0].text if response.content else "{}"
            result = self._extract_json(content)

            if result is None or "subtasks" not in result:
                return await self._decompose_generic(query, analysis, max_subtasks)

            subtasks = [
                SubtaskDefinition(
                    task_type=s.get("task_type", "dimension_analysis"),
                    entity_id=s.get("entity_id"),
                    input_data=s.get("input_data", {}),
                    priority=s.get("priority", 5),
                    estimated_duration_seconds=s.get("estimated_duration_seconds", 60),
                    depends_on_indices=s.get("depends_on_indices", []),
                )
                for s in result["subtasks"]
            ]

            return subtasks, result.get("reasoning", "Dimension-based decomposition")

        except Exception as e:
            logger.error(f"Dimension decomposition error: {e}")
            return await self._decompose_generic(query, analysis, max_subtasks)

    async def _decompose_by_source(
        self,
        query: str,
        analysis: Dict[str, Any],
        max_subtasks: int
    ) -> tuple[List[SubtaskDefinition], str]:
        """Decompose query by data sources."""
        sources = analysis.get("sources", [])

        if not sources:
            sources = ["web", "news", "academic"]

        subtasks = []
        for i, source in enumerate(sources[:max_subtasks - 1]):
            subtasks.append(SubtaskDefinition(
                task_type="source_research",
                entity_id=None,
                input_data={
                    "source_type": source,
                    "query": query,
                    "goal": analysis.get("goal", ""),
                },
                priority=5,
                estimated_duration_seconds=90,
                depends_on_indices=[],
            ))

        # Add synthesis subtask
        subtasks.append(SubtaskDefinition(
            task_type="synthesis",
            entity_id=None,
            input_data={
                "query": query,
                "goal": "Synthesize results from all sources",
            },
            priority=8,
            estimated_duration_seconds=120,
            depends_on_indices=list(range(len(subtasks))),
        ))

        return subtasks, "Source-based decomposition"

    async def _decompose_generic(
        self,
        query: str,
        analysis: Dict[str, Any],
        max_subtasks: int
    ) -> tuple[List[SubtaskDefinition], str]:
        """Generic decomposition for queries that don't fit other strategies."""
        # Create a single research subtask
        subtasks = [
            SubtaskDefinition(
                task_type="research",
                entity_id=None,
                input_data={
                    "query": query,
                    "goal": analysis.get("goal", query[:200]),
                    "focus_areas": analysis.get("dimensions", ["general"]),
                },
                priority=5,
                estimated_duration_seconds=180,
                depends_on_indices=[],
            ),
            SubtaskDefinition(
                task_type="synthesis",
                entity_id=None,
                input_data={
                    "query": query,
                    "goal": "Compile and format research results",
                },
                priority=8,
                estimated_duration_seconds=60,
                depends_on_indices=[0],
            ),
        ]

        return subtasks, "Generic decomposition (single research task + synthesis)"

    def _build_dependency_graph(
        self,
        subtasks: List[SubtaskDefinition]
    ) -> Dict[str, List[str]]:
        """Build dependency graph from subtask definitions."""
        # Dependencies are stored as indices, convert to a graph structure
        graph = {}
        for i, subtask in enumerate(subtasks):
            graph[str(i)] = [str(idx) for idx in subtask.depends_on_indices]
        return graph

    def _estimate_resources(
        self,
        subtasks: List[SubtaskDefinition]
    ) -> Dict[str, Any]:
        """Estimate resource requirements."""
        total_seconds = sum(s.estimated_duration_seconds for s in subtasks)

        # Calculate parallel duration (assuming max parallelism)
        # Simple heuristic: take the longest chain
        parallel_seconds = self._estimate_parallel_duration(subtasks)

        # Cost estimation (rough)
        # Assume $0.01 per subtask for LLM calls
        cost_usd = len(subtasks) * 0.01

        return {
            "duration_minutes": max(1, parallel_seconds // 60),
            "serial_duration_minutes": max(1, total_seconds // 60),
            "cost_usd": cost_usd,
        }

    def _estimate_parallel_duration(
        self,
        subtasks: List[SubtaskDefinition]
    ) -> int:
        """Estimate duration with parallel execution."""
        if not subtasks:
            return 0

        # Build dependency levels
        levels: Dict[int, int] = {}
        for i, subtask in enumerate(subtasks):
            if not subtask.depends_on_indices:
                levels[i] = 0
            else:
                max_dep_level = max(
                    levels.get(dep, 0) for dep in subtask.depends_on_indices
                )
                levels[i] = max_dep_level + 1

        # Group by level and sum max duration per level
        level_durations: Dict[int, int] = {}
        for i, level in levels.items():
            duration = subtasks[i].estimated_duration_seconds
            level_durations[level] = max(level_durations.get(level, 0), duration)

        return sum(level_durations.values())

    def _extract_json(self, content: str) -> Optional[dict]:
        """Extract JSON from LLM response."""
        import re

        # Try parsing directly
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code block
        match = re.search(r"```json\s*([\s\S]*?)\s*```", content)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try extracting from generic code block
        match = re.search(r"```\s*([\s\S]*?)\s*```", content)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try finding JSON object in text
        match = re.search(r'\{[\s\S]*\}', content)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        return None
