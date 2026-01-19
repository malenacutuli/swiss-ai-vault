"""Result Synthesizer - Combines research results"""

import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class ResultSynthesizer:
    """Synthesize research results"""

    def __init__(self):
        """Initialize synthesizer"""
        pass

    def synthesize(
        self,
        topic: str,
        results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Synthesize research results.

        Args:
            topic: Research topic
            results: List of research results

        Returns:
            Synthesized findings
        """
        if not results:
            return {"topic": topic, "findings": []}

        # Group results by aspect
        grouped = self._group_results(results)

        # Create synthesis
        synthesis = {
            "topic": topic,
            "summary": self._create_summary(grouped),
            "key_findings": self._extract_key_findings(grouped),
            "recommendations": self._generate_recommendations(grouped),
            "sources": self._collect_sources(results),
            "confidence": self._calculate_confidence(results)
        }

        logger.info(f"Synthesized results for topic: {topic}")
        return synthesis

    def _group_results(self, results: List[Dict[str, Any]]) -> Dict[str, List[Dict]]:
        """Group results by aspect"""
        grouped = {}

        for result in results:
            aspect = result.get("aspect", "general")

            if aspect not in grouped:
                grouped[aspect] = []

            grouped[aspect].append(result)

        return grouped

    def _create_summary(self, grouped: Dict[str, List[Dict]]) -> str:
        """Create summary from grouped results"""
        summaries = []

        for aspect, results in grouped.items():
            if results:
                summary = results[0].get("summary", "")
                if summary:
                    summaries.append(f"{aspect}: {summary}")

        return " ".join(summaries)

    def _extract_key_findings(self, grouped: Dict[str, List[Dict]]) -> List[str]:
        """Extract key findings"""
        findings = []

        for aspect, results in grouped.items():
            for result in results:
                if "findings" in result:
                    findings.extend(result["findings"])

        return findings[:10]  # Top 10 findings

    def _generate_recommendations(self, grouped: Dict[str, List[Dict]]) -> List[str]:
        """Generate recommendations"""
        recommendations = []

        for aspect, results in grouped.items():
            for result in results:
                if "recommendations" in result:
                    recommendations.extend(result["recommendations"])

        return recommendations[:5]  # Top 5 recommendations

    def _collect_sources(self, results: List[Dict[str, Any]]) -> List[str]:
        """Collect sources from results"""
        sources = []

        for result in results:
            if "sources" in result:
                sources.extend(result["sources"])

        return list(set(sources))  # Unique sources

    def _calculate_confidence(self, results: List[Dict[str, Any]]) -> float:
        """Calculate confidence score"""
        if not results:
            return 0.0

        total_confidence = sum(
            result.get("confidence", 0.5) for result in results
        )

        return total_confidence / len(results)
