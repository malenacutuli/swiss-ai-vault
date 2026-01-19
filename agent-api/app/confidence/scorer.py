"""
Confidence Scoring & UI Transparency per SWISSBRAIN_INTELLIGENCE_STACK.md

Implements Section 7: Confidence Scoring & UI Transparency
- Confidence → Language Mapping (hedging)
- UI Display Rules (indicators)

Source: SWISSBRAIN_INTELLIGENCE_STACK.md Section 7
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


# ============================================================================
# Enums
# ============================================================================


class ConfidenceLevel(Enum):
    """Discrete confidence levels."""

    VERY_HIGH = "very_high"  # >= 0.9
    HIGH = "high"  # >= 0.7
    MEDIUM = "medium"  # >= 0.5
    LOW = "low"  # >= 0.3
    VERY_LOW = "very_low"  # < 0.3


class HedgingIntensity(Enum):
    """
    Hedging intensity levels per spec.
    Source: SWISSBRAIN_INTELLIGENCE_STACK.md Section 7.1
    """

    NONE = "none"  # confidence >= 0.9
    LIGHT = "light"  # confidence >= 0.7
    MODERATE = "moderate"  # confidence >= 0.5
    HEAVY = "heavy"  # confidence >= 0.3
    MAXIMUM = "maximum"  # confidence < 0.3


class ConfidenceSourceType(Enum):
    """Types of sources contributing to confidence."""

    VERIFIED_DATA = "verified_data"  # Authoritative source
    MULTIPLE_SOURCES = "multiple_sources"  # Corroborated
    SINGLE_SOURCE = "single_source"  # One reference
    INFERENCE = "inference"  # Derived/calculated
    ASSUMPTION = "assumption"  # Not verified
    MODEL_OUTPUT = "model_output"  # LLM generated


class DisplayIndicator(Enum):
    """
    UI indicator types per spec.
    Source: SWISSBRAIN_INTELLIGENCE_STACK.md Section 7.2
    """

    NONE = "none"  # High confidence, no indicator
    SUBTLE = "subtle"  # Medium confidence, subtle hint
    PROMINENT = "prominent"  # Low confidence, visible warning


# ============================================================================
# Data Models
# ============================================================================


@dataclass
class ConfidenceSource:
    """A source contributing to confidence score."""

    source_type: ConfidenceSourceType
    source_id: Optional[str] = None
    source_url: Optional[str] = None
    weight: float = 1.0
    freshness_score: float = 1.0  # 0-1, 1 = fresh
    authority_score: float = 0.5  # 0-1, 1 = high authority
    relevance_score: float = 0.5  # 0-1, 1 = highly relevant
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LanguageHedging:
    """
    Language hedging rules per confidence level.
    Source: SWISSBRAIN_INTELLIGENCE_STACK.md Section 7.1 (confidence_to_language)
    """

    hedging: HedgingIntensity
    verbs: List[str]
    qualifiers: List[str]
    example: str


@dataclass
class UIDisplay:
    """
    UI display rules per confidence level.
    Source: SWISSBRAIN_INTELLIGENCE_STACK.md Section 7.2 (confidence_to_ui_display)
    """

    show_indicator: bool
    indicator_type: Optional[DisplayIndicator] = None
    tooltip: Optional[str] = None
    expandable: bool = False


@dataclass
class ConfidenceResult:
    """Result of confidence scoring."""

    score: float  # 0-1 confidence score
    level: ConfidenceLevel
    sources: List[ConfidenceSource] = field(default_factory=list)
    hedging: Optional[LanguageHedging] = None
    display: Optional[UIDisplay] = None
    reasoning: Optional[str] = None
    idempotency_key: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "score": self.score,
            "level": self.level.value,
            "sources": [
                {
                    "type": s.source_type.value,
                    "weight": s.weight,
                    "authority": s.authority_score,
                }
                for s in self.sources
            ],
            "hedging": self.hedging.hedging.value if self.hedging else None,
            "show_indicator": self.display.show_indicator if self.display else False,
            "reasoning": self.reasoning,
            "idempotency_key": self.idempotency_key,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class TransparencyRule:
    """Rule for transparency display."""

    min_confidence: float
    max_confidence: float
    show_sources: bool = False
    show_reasoning: bool = False
    require_human_review: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


# ============================================================================
# Language Mapping (Section 7.1)
# ============================================================================


def confidence_to_language(confidence: float) -> LanguageHedging:
    """
    Map confidence score to language hedging rules.

    Exact implementation from SWISSBRAIN_INTELLIGENCE_STACK.md Section 7.1
    """
    if confidence >= 0.9:
        return LanguageHedging(
            hedging=HedgingIntensity.NONE,
            verbs=["is", "shows", "demonstrates", "confirms"],
            qualifiers=[],
            example="The data shows a 15% increase.",
        )

    if confidence >= 0.7:
        return LanguageHedging(
            hedging=HedgingIntensity.LIGHT,
            verbs=["indicates", "suggests", "points to"],
            qualifiers=["generally", "typically"],
            example="The data suggests a 15% increase.",
        )

    if confidence >= 0.5:
        return LanguageHedging(
            hedging=HedgingIntensity.MODERATE,
            verbs=["may indicate", "appears to show", "seems to suggest"],
            qualifiers=["possibly", "potentially"],
            example="The data appears to show approximately a 15% increase.",
        )

    if confidence >= 0.3:
        return LanguageHedging(
            hedging=HedgingIntensity.HEAVY,
            verbs=["might", "could potentially", "some sources suggest"],
            qualifiers=["uncertain", "limited data suggests"],
            example="Limited data suggests there might be around a 15% increase.",
        )

    return LanguageHedging(
        hedging=HedgingIntensity.MAXIMUM,
        verbs=["is unclear", "cannot be determined"],
        qualifiers=["highly uncertain", "speculative", "unverified"],
        example="It is unclear whether there has been an increase.",
    )


# ============================================================================
# UI Display Rules (Section 7.2)
# ============================================================================


def confidence_to_ui_display(confidence: float) -> UIDisplay:
    """
    Map confidence score to UI display rules.

    Exact implementation from SWISSBRAIN_INTELLIGENCE_STACK.md Section 7.2
    """
    # HIGH CONFIDENCE: No indicator
    if confidence >= 0.8:
        return UIDisplay(show_indicator=False)

    # MEDIUM CONFIDENCE: Subtle indicator
    if confidence >= 0.5:
        return UIDisplay(
            show_indicator=True,
            indicator_type=DisplayIndicator.SUBTLE,
            tooltip="Based on limited sources",
            expandable=True,
        )

    # LOW CONFIDENCE: Prominent warning
    return UIDisplay(
        show_indicator=True,
        indicator_type=DisplayIndicator.PROMINENT,
        tooltip="Highly uncertain - verify before using",
        expandable=True,
    )


def score_to_level(score: float) -> ConfidenceLevel:
    """Convert numeric score to confidence level."""
    if score >= 0.9:
        return ConfidenceLevel.VERY_HIGH
    if score >= 0.7:
        return ConfidenceLevel.HIGH
    if score >= 0.5:
        return ConfidenceLevel.MEDIUM
    if score >= 0.3:
        return ConfidenceLevel.LOW
    return ConfidenceLevel.VERY_LOW


# ============================================================================
# Confidence Scorer
# ============================================================================


class ConfidenceScorer:
    """
    Scores confidence based on sources and context.

    Combines multiple signals to produce overall confidence.
    """

    # Weights for different source types
    SOURCE_TYPE_WEIGHTS = {
        ConfidenceSourceType.VERIFIED_DATA: 1.0,
        ConfidenceSourceType.MULTIPLE_SOURCES: 0.9,
        ConfidenceSourceType.SINGLE_SOURCE: 0.6,
        ConfidenceSourceType.INFERENCE: 0.5,
        ConfidenceSourceType.MODEL_OUTPUT: 0.4,
        ConfidenceSourceType.ASSUMPTION: 0.2,
    }

    def __init__(
        self,
        min_sources_for_high_confidence: int = 3,
        freshness_weight: float = 0.2,
        authority_weight: float = 0.3,
        relevance_weight: float = 0.3,
        source_type_weight: float = 0.2,
        metrics_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        """
        Initialize the confidence scorer.

        Args:
            min_sources_for_high_confidence: Minimum sources for >= 0.8 confidence
            freshness_weight: Weight for source freshness in scoring
            authority_weight: Weight for source authority in scoring
            relevance_weight: Weight for source relevance in scoring
            source_type_weight: Weight for source type in scoring
            metrics_callback: Optional callback for metrics emission
        """
        self.min_sources = min_sources_for_high_confidence
        self.freshness_weight = freshness_weight
        self.authority_weight = authority_weight
        self.relevance_weight = relevance_weight
        self.source_type_weight = source_type_weight
        self._metrics_callback = metrics_callback

    def _emit_metrics(self, metrics: Dict[str, Any]) -> None:
        """Emit metrics if callback configured."""
        if self._metrics_callback:
            try:
                self._metrics_callback(metrics)
            except Exception as e:
                logger.warning(f"Failed to emit metrics: {e}")

    def score_source(self, source: ConfidenceSource) -> float:
        """
        Score a single source.

        Returns weighted combination of:
        - Source type (verified, inferred, etc.)
        - Freshness
        - Authority
        - Relevance
        """
        type_score = self.SOURCE_TYPE_WEIGHTS.get(
            source.source_type, 0.5
        )

        weighted_score = (
            type_score * self.source_type_weight
            + source.freshness_score * self.freshness_weight
            + source.authority_score * self.authority_weight
            + source.relevance_score * self.relevance_weight
        )

        return min(1.0, weighted_score * source.weight)

    def score(
        self,
        sources: List[ConfidenceSource],
        context: Optional[Dict[str, Any]] = None,
        include_hedging: bool = True,
        include_display: bool = True,
    ) -> ConfidenceResult:
        """
        Calculate confidence score from sources.

        Args:
            sources: List of confidence sources
            context: Optional context for scoring
            include_hedging: Whether to include language hedging
            include_display: Whether to include UI display rules

        Returns:
            ConfidenceResult with score, level, hedging, and display rules
        """
        if not sources:
            # No sources = very low confidence
            score = 0.1
            reasoning = "No sources available"
        else:
            # Calculate individual source scores
            source_scores = [self.score_source(s) for s in sources]

            # Weighted average
            total_weight = sum(s.weight for s in sources)
            if total_weight > 0:
                weighted_sum = sum(
                    self.score_source(s) * s.weight for s in sources
                )
                base_score = weighted_sum / total_weight
            else:
                base_score = sum(source_scores) / len(source_scores)

            # Bonus for multiple sources
            source_count_bonus = min(0.2, len(sources) * 0.05)

            # Penalty for conflicting source types
            source_types = {s.source_type for s in sources}
            has_verified = ConfidenceSourceType.VERIFIED_DATA in source_types
            has_assumption = ConfidenceSourceType.ASSUMPTION in source_types
            conflict_penalty = 0.1 if (has_verified and has_assumption) else 0

            score = min(1.0, max(0.0, base_score + source_count_bonus - conflict_penalty))

            # Cap score if too few sources
            if len(sources) < self.min_sources:
                score = min(score, 0.75)

            reasoning = f"Based on {len(sources)} source(s), " \
                       f"avg quality {sum(source_scores)/len(source_scores):.2f}"

        # Determine level
        level = score_to_level(score)

        # Get hedging rules
        hedging = confidence_to_language(score) if include_hedging else None

        # Get display rules
        display = confidence_to_ui_display(score) if include_display else None

        result = ConfidenceResult(
            score=round(score, 4),
            level=level,
            sources=sources,
            hedging=hedging,
            display=display,
            reasoning=reasoning,
        )

        # Emit metrics
        self._emit_metrics({
            "type": "confidence_score",
            "score": score,
            "level": level.value,
            "source_count": len(sources),
            "hedging": hedging.hedging.value if hedging else None,
        })

        logger.info(
            "Confidence scored",
            extra={
                "score": score,
                "level": level.value,
                "source_count": len(sources),
            },
        )

        return result

    def score_text(
        self,
        text: str,
        claimed_sources: Optional[List[str]] = None,
        has_citations: bool = False,
    ) -> ConfidenceResult:
        """
        Heuristic scoring for text content.

        Uses text analysis to estimate confidence when explicit sources
        aren't available.

        Args:
            text: Text to score
            claimed_sources: URLs or references mentioned
            has_citations: Whether text includes citations
        """
        sources = []

        # Text-based heuristics
        # Check for hedging language (indicates lower confidence)
        hedge_words = ["might", "could", "possibly", "perhaps", "may", "seems"]
        hedge_count = sum(1 for word in hedge_words if word in text.lower())

        # Check for certainty language
        certainty_words = ["definitely", "certainly", "proven", "confirmed"]
        certainty_count = sum(1 for word in certainty_words if word in text.lower())

        # Create synthetic source based on text analysis
        if has_citations and claimed_sources:
            for url in claimed_sources[:5]:  # Cap at 5
                sources.append(ConfidenceSource(
                    source_type=ConfidenceSourceType.SINGLE_SOURCE,
                    source_url=url,
                    authority_score=0.6,
                    relevance_score=0.7,
                ))
        elif has_citations:
            sources.append(ConfidenceSource(
                source_type=ConfidenceSourceType.MULTIPLE_SOURCES,
                authority_score=0.5,
                relevance_score=0.6,
            ))
        else:
            # No citations - lower confidence
            source_type = ConfidenceSourceType.MODEL_OUTPUT
            if hedge_count > 2:
                source_type = ConfidenceSourceType.ASSUMPTION
            elif certainty_count > 0:
                source_type = ConfidenceSourceType.INFERENCE

            sources.append(ConfidenceSource(
                source_type=source_type,
                authority_score=0.4,
                relevance_score=0.5,
            ))

        return self.score(sources)


# ============================================================================
# Language Hedger
# ============================================================================


class LanguageHedger:
    """
    Applies language hedging to text based on confidence.

    Uses rules from SWISSBRAIN_INTELLIGENCE_STACK.md Section 7.1
    """

    def __init__(self):
        """Initialize the language hedger."""
        # Patterns for verb replacement
        self._strong_verbs = {
            "is": ["indicates", "suggests", "may be", "appears to be", "is unclear whether it is"],
            "are": ["indicate", "suggest", "may be", "appear to be", "is unclear whether they are"],
            "shows": ["suggests", "indicates", "may show", "appears to show", "is unclear whether it shows"],
            "demonstrates": ["suggests", "indicates", "may demonstrate", "seems to demonstrate", "is unclear"],
            "confirms": ["suggests", "indicates", "may confirm", "seems to confirm", "is unclear"],
            "proves": ["suggests", "indicates", "may prove", "seems to prove", "is unclear"],
        }

    def apply_hedging(
        self,
        text: str,
        confidence: float,
        preserve_structure: bool = True,
    ) -> str:
        """
        Apply hedging to text based on confidence level.

        Args:
            text: Original text
            confidence: Confidence score (0-1)
            preserve_structure: Whether to preserve sentence structure

        Returns:
            Hedged text
        """
        if confidence >= 0.9:
            # No hedging needed
            return text

        hedging = confidence_to_language(confidence)

        # Add qualifier prefix for lower confidence
        if confidence < 0.5:
            qualifier = hedging.qualifiers[0] if hedging.qualifiers else "possibly"
            if not text.lower().startswith(qualifier):
                text = f"{qualifier.capitalize()}, {text[0].lower()}{text[1:]}"

        # Replace strong verbs with hedged versions
        if confidence < 0.7:
            hedging_level = 0 if confidence >= 0.5 else (1 if confidence >= 0.3 else 2)
            for strong, replacements in self._strong_verbs.items():
                if strong in text.lower():
                    replacement = replacements[min(hedging_level, len(replacements) - 1)]
                    # Case-sensitive replacement
                    text = text.replace(strong, replacement)
                    text = text.replace(strong.capitalize(), replacement.capitalize())

        return text

    def get_hedging_rules(self, confidence: float) -> LanguageHedging:
        """Get hedging rules for a confidence level."""
        return confidence_to_language(confidence)


# ============================================================================
# Transparency Display
# ============================================================================


class TransparencyDisplay:
    """
    Manages transparency display rules.

    Determines when to show confidence indicators, sources, etc.
    """

    def __init__(self, rules: Optional[List[TransparencyRule]] = None):
        """Initialize with optional custom rules."""
        self.rules = rules or self._default_rules()

    def _default_rules(self) -> List[TransparencyRule]:
        """Default transparency rules."""
        return [
            TransparencyRule(
                min_confidence=0.8,
                max_confidence=1.0,
                show_sources=False,
                show_reasoning=False,
                require_human_review=False,
            ),
            TransparencyRule(
                min_confidence=0.5,
                max_confidence=0.8,
                show_sources=True,
                show_reasoning=False,
                require_human_review=False,
            ),
            TransparencyRule(
                min_confidence=0.3,
                max_confidence=0.5,
                show_sources=True,
                show_reasoning=True,
                require_human_review=False,
            ),
            TransparencyRule(
                min_confidence=0.0,
                max_confidence=0.3,
                show_sources=True,
                show_reasoning=True,
                require_human_review=True,
            ),
        ]

    def get_rule(self, confidence: float) -> Optional[TransparencyRule]:
        """Get transparency rule for a confidence level."""
        for rule in self.rules:
            if rule.min_confidence <= confidence < rule.max_confidence:
                return rule
        # Edge case: exact 1.0
        if confidence >= 1.0 and self.rules:
            return self.rules[0]
        return None

    def get_display(self, confidence: float) -> UIDisplay:
        """Get UI display settings for a confidence level."""
        return confidence_to_ui_display(confidence)

    def should_show_sources(self, confidence: float) -> bool:
        """Check if sources should be shown."""
        rule = self.get_rule(confidence)
        return rule.show_sources if rule else True

    def should_show_reasoning(self, confidence: float) -> bool:
        """Check if reasoning should be shown."""
        rule = self.get_rule(confidence)
        return rule.show_reasoning if rule else True

    def requires_human_review(self, confidence: float) -> bool:
        """Check if human review is required."""
        rule = self.get_rule(confidence)
        return rule.require_human_review if rule else True


# ============================================================================
# Module-level instances
# ============================================================================

_confidence_scorer: Optional[ConfidenceScorer] = None
_language_hedger: Optional[LanguageHedger] = None
_transparency_display: Optional[TransparencyDisplay] = None


def get_confidence_scorer() -> ConfidenceScorer:
    """Get default confidence scorer instance."""
    global _confidence_scorer
    if _confidence_scorer is None:
        _confidence_scorer = ConfidenceScorer()
    return _confidence_scorer


def set_confidence_scorer(scorer: ConfidenceScorer) -> None:
    """Set default confidence scorer instance."""
    global _confidence_scorer
    _confidence_scorer = scorer


def reset_confidence_scorer() -> None:
    """Reset default confidence scorer instance."""
    global _confidence_scorer
    _confidence_scorer = None


def get_language_hedger() -> LanguageHedger:
    """Get default language hedger instance."""
    global _language_hedger
    if _language_hedger is None:
        _language_hedger = LanguageHedger()
    return _language_hedger


def set_language_hedger(hedger: LanguageHedger) -> None:
    """Set default language hedger instance."""
    global _language_hedger
    _language_hedger = hedger


def get_transparency_display() -> TransparencyDisplay:
    """Get default transparency display instance."""
    global _transparency_display
    if _transparency_display is None:
        _transparency_display = TransparencyDisplay()
    return _transparency_display


def set_transparency_display(display: TransparencyDisplay) -> None:
    """Set default transparency display instance."""
    global _transparency_display
    _transparency_display = display
