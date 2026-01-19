"""
Confidence Scoring and Transparency System

Implements:
- Confidence scoring for AI outputs (0.0-1.0 scale)
- Language hedging based on confidence levels
- UI transparency display rules
- Integration with conflict resolution
- Source tracking for confidence calculations
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
import asyncio
import statistics


class ConfidenceLevel(Enum):
    """Confidence level categories."""
    VERY_HIGH = "very_high"      # 0.9+
    HIGH = "high"                # 0.8-0.89
    MEDIUM_HIGH = "medium_high"  # 0.7-0.79
    MEDIUM = "medium"            # 0.5-0.69
    LOW = "low"                  # 0.3-0.49
    VERY_LOW = "very_low"        # <0.3


class ConfidenceSourceType(Enum):
    """Types of confidence sources."""
    HUMAN_INPUT = "human_input"
    AI_GENERATION = "ai_generation"
    DATA_QUALITY = "data_quality"
    SOURCE_RELIABILITY = "source_reliability"
    TEMPORAL_FRESHNESS = "temporal_freshness"
    CONSENSUS = "consensus"
    VERIFICATION = "verification"
    HISTORICAL_ACCURACY = "historical_accuracy"


class HedgingIntensity(Enum):
    """Language hedging intensity levels."""
    NONE = "none"           # Definitive language
    LIGHT = "light"         # Slight hedging
    MODERATE = "moderate"   # Moderate hedging
    HEAVY = "heavy"         # Heavy hedging
    MAXIMUM = "maximum"     # Maximum uncertainty


class DisplayIndicator(Enum):
    """UI display indicator types."""
    NONE = "none"              # No indicator needed
    SUBTLE = "subtle"          # Small icon or color hint
    MODERATE = "moderate"      # Visible indicator
    PROMINENT = "prominent"    # Warning-level indicator
    CRITICAL = "critical"      # Blocking warning


@dataclass
class ConfidenceSource:
    """A source contributing to confidence calculation."""
    source_type: ConfidenceSourceType
    score: float  # 0.0-1.0
    weight: float = 1.0
    reason: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def weighted_score(self) -> float:
        """Calculate weighted score."""
        return self.score * self.weight


@dataclass
class ConfidenceResult:
    """Result of a confidence calculation."""
    score: float  # 0.0-1.0
    level: ConfidenceLevel
    sources: List[ConfidenceSource]
    reasoning: str
    hedging: HedgingIntensity
    display_indicator: DisplayIndicator
    metadata: Dict[str, Any] = field(default_factory=dict)
    calculated_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "score": self.score,
            "level": self.level.value,
            "reasoning": self.reasoning,
            "hedging": self.hedging.value,
            "display_indicator": self.display_indicator.value,
            "source_count": len(self.sources),
            "calculated_at": self.calculated_at.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class ConfidenceConfig:
    """Configuration for confidence scoring."""
    # Thresholds for confidence levels
    very_high_threshold: float = 0.9
    high_threshold: float = 0.8
    medium_high_threshold: float = 0.7
    medium_threshold: float = 0.5
    low_threshold: float = 0.3

    # Default weights for source types
    source_weights: Dict[ConfidenceSourceType, float] = field(default_factory=lambda: {
        ConfidenceSourceType.HUMAN_INPUT: 1.0,
        ConfidenceSourceType.AI_GENERATION: 0.7,
        ConfidenceSourceType.DATA_QUALITY: 0.8,
        ConfidenceSourceType.SOURCE_RELIABILITY: 0.85,
        ConfidenceSourceType.TEMPORAL_FRESHNESS: 0.6,
        ConfidenceSourceType.CONSENSUS: 0.9,
        ConfidenceSourceType.VERIFICATION: 0.95,
        ConfidenceSourceType.HISTORICAL_ACCURACY: 0.75,
    })

    # Temporal decay settings
    enable_temporal_decay: bool = True
    decay_half_life_hours: float = 168.0  # 1 week

    # Aggregation settings
    aggregation_method: str = "weighted_average"  # weighted_average, minimum, geometric_mean
    require_minimum_sources: int = 1

    # Auto-adjustment settings
    enable_auto_calibration: bool = False
    calibration_window_days: int = 30


class ConfidenceScorer:
    """
    Core confidence scoring engine.

    Calculates confidence scores based on multiple sources
    and provides reasoning for the calculated confidence.
    """

    def __init__(self, config: Optional[ConfidenceConfig] = None):
        self.config = config or ConfidenceConfig()
        self._lock = asyncio.Lock()
        self._history: List[ConfidenceResult] = []
        self._calibration_data: Dict[str, List[Tuple[float, bool]]] = {}

    def calculate_confidence(
        self,
        sources: List[ConfidenceSource],
        context: Optional[Dict[str, Any]] = None
    ) -> ConfidenceResult:
        """
        Calculate confidence from multiple sources.

        Args:
            sources: List of confidence sources
            context: Optional context for calculation

        Returns:
            ConfidenceResult with calculated score and metadata
        """
        if not sources:
            return self._create_no_confidence_result()

        # Apply default weights if not specified
        weighted_sources = self._apply_weights(sources)

        # Apply temporal decay if enabled
        if self.config.enable_temporal_decay:
            weighted_sources = self._apply_temporal_decay(weighted_sources)

        # Aggregate scores
        score = self._aggregate_scores(weighted_sources)

        # Determine level
        level = self._score_to_level(score)

        # Generate reasoning
        reasoning = self._generate_reasoning(weighted_sources, score, context)

        # Determine hedging and display
        hedging = self._score_to_hedging(score)
        display = self._score_to_display(score)

        return ConfidenceResult(
            score=score,
            level=level,
            sources=sources,
            reasoning=reasoning,
            hedging=hedging,
            display_indicator=display,
            metadata=context or {},
        )

    def calculate_from_single(
        self,
        source_type: ConfidenceSourceType,
        score: float,
        reason: str = ""
    ) -> ConfidenceResult:
        """Calculate confidence from a single source."""
        source = ConfidenceSource(
            source_type=source_type,
            score=score,
            reason=reason,
        )
        return self.calculate_confidence([source])

    def calculate_human_confidence(
        self,
        verified: bool = False,
        edited: bool = False
    ) -> ConfidenceResult:
        """Calculate confidence for human input."""
        sources = []

        base_score = 0.95 if verified else 0.85
        sources.append(ConfidenceSource(
            source_type=ConfidenceSourceType.HUMAN_INPUT,
            score=base_score,
            reason="Human-provided input",
        ))

        if verified:
            sources.append(ConfidenceSource(
                source_type=ConfidenceSourceType.VERIFICATION,
                score=0.98,
                reason="Content verified by human",
            ))

        if edited:
            sources.append(ConfidenceSource(
                source_type=ConfidenceSourceType.HUMAN_INPUT,
                score=0.90,
                weight=0.5,
                reason="Human edited content",
            ))

        return self.calculate_confidence(sources)

    def calculate_ai_confidence(
        self,
        model_confidence: float,
        source_quality: float = 0.5,
        data_freshness: float = 0.5,
        consensus_score: Optional[float] = None
    ) -> ConfidenceResult:
        """Calculate confidence for AI-generated content."""
        sources = [
            ConfidenceSource(
                source_type=ConfidenceSourceType.AI_GENERATION,
                score=model_confidence,
                reason=f"AI model confidence: {model_confidence:.2f}",
            ),
            ConfidenceSource(
                source_type=ConfidenceSourceType.DATA_QUALITY,
                score=source_quality,
                reason=f"Source data quality: {source_quality:.2f}",
            ),
            ConfidenceSource(
                source_type=ConfidenceSourceType.TEMPORAL_FRESHNESS,
                score=data_freshness,
                reason=f"Data freshness: {data_freshness:.2f}",
            ),
        ]

        if consensus_score is not None:
            sources.append(ConfidenceSource(
                source_type=ConfidenceSourceType.CONSENSUS,
                score=consensus_score,
                reason=f"Multi-source consensus: {consensus_score:.2f}",
            ))

        return self.calculate_confidence(sources)

    def _apply_weights(self, sources: List[ConfidenceSource]) -> List[ConfidenceSource]:
        """Apply default weights to sources without explicit weights."""
        result = []
        for source in sources:
            if source.weight == 1.0:  # Default weight, apply config
                default_weight = self.config.source_weights.get(
                    source.source_type, 1.0
                )
                result.append(ConfidenceSource(
                    source_type=source.source_type,
                    score=source.score,
                    weight=default_weight,
                    reason=source.reason,
                    metadata=source.metadata,
                    timestamp=source.timestamp,
                ))
            else:
                result.append(source)
        return result

    def _apply_temporal_decay(
        self, sources: List[ConfidenceSource]
    ) -> List[ConfidenceSource]:
        """Apply temporal decay to source scores."""
        now = datetime.utcnow()
        half_life = timedelta(hours=self.config.decay_half_life_hours)

        result = []
        for source in sources:
            age = now - source.timestamp
            # Exponential decay: score * 0.5^(age/half_life)
            decay_factor = 0.5 ** (age.total_seconds() / half_life.total_seconds())
            # Minimum decay factor of 0.5 to prevent scores from becoming negligible
            decay_factor = max(0.5, decay_factor)

            result.append(ConfidenceSource(
                source_type=source.source_type,
                score=source.score * decay_factor,
                weight=source.weight,
                reason=source.reason,
                metadata={**source.metadata, "decay_factor": decay_factor},
                timestamp=source.timestamp,
            ))
        return result

    def _aggregate_scores(self, sources: List[ConfidenceSource]) -> float:
        """Aggregate scores from multiple sources."""
        if not sources:
            return 0.0

        method = self.config.aggregation_method

        if method == "weighted_average":
            total_weight = sum(s.weight for s in sources)
            if total_weight == 0:
                return 0.0
            weighted_sum = sum(s.score * s.weight for s in sources)
            return weighted_sum / total_weight

        elif method == "minimum":
            return min(s.score for s in sources)

        elif method == "geometric_mean":
            product = 1.0
            for s in sources:
                product *= s.score ** s.weight
            total_weight = sum(s.weight for s in sources)
            return product ** (1 / total_weight) if total_weight > 0 else 0.0

        else:
            # Default to weighted average
            total_weight = sum(s.weight for s in sources)
            if total_weight == 0:
                return 0.0
            return sum(s.score * s.weight for s in sources) / total_weight

    def _score_to_level(self, score: float) -> ConfidenceLevel:
        """Convert score to confidence level."""
        if score >= self.config.very_high_threshold:
            return ConfidenceLevel.VERY_HIGH
        elif score >= self.config.high_threshold:
            return ConfidenceLevel.HIGH
        elif score >= self.config.medium_high_threshold:
            return ConfidenceLevel.MEDIUM_HIGH
        elif score >= self.config.medium_threshold:
            return ConfidenceLevel.MEDIUM
        elif score >= self.config.low_threshold:
            return ConfidenceLevel.LOW
        else:
            return ConfidenceLevel.VERY_LOW

    def _score_to_hedging(self, score: float) -> HedgingIntensity:
        """Map score to hedging intensity."""
        if score >= 0.9:
            return HedgingIntensity.NONE
        elif score >= 0.7:
            return HedgingIntensity.LIGHT
        elif score >= 0.5:
            return HedgingIntensity.MODERATE
        elif score >= 0.3:
            return HedgingIntensity.HEAVY
        else:
            return HedgingIntensity.MAXIMUM

    def _score_to_display(self, score: float) -> DisplayIndicator:
        """Map score to display indicator."""
        if score >= 0.8:
            return DisplayIndicator.NONE
        elif score >= 0.6:
            return DisplayIndicator.SUBTLE
        elif score >= 0.4:
            return DisplayIndicator.MODERATE
        elif score >= 0.2:
            return DisplayIndicator.PROMINENT
        else:
            return DisplayIndicator.CRITICAL

    def _generate_reasoning(
        self,
        sources: List[ConfidenceSource],
        score: float,
        context: Optional[Dict[str, Any]]
    ) -> str:
        """Generate human-readable reasoning for the confidence score."""
        parts = []

        # Overall summary
        level = self._score_to_level(score)
        parts.append(f"Confidence: {level.value.replace('_', ' ')} ({score:.2f})")

        # Source breakdown
        if sources:
            parts.append(f"Based on {len(sources)} source(s):")
            for source in sorted(sources, key=lambda s: s.weighted_score(), reverse=True)[:3]:
                parts.append(
                    f"  - {source.source_type.value}: {source.score:.2f} "
                    f"(weight: {source.weight:.2f})"
                )
                if source.reason:
                    parts.append(f"    {source.reason}")

        return "\n".join(parts)

    def _create_no_confidence_result(self) -> ConfidenceResult:
        """Create a result for when no sources are available."""
        return ConfidenceResult(
            score=0.0,
            level=ConfidenceLevel.VERY_LOW,
            sources=[],
            reasoning="No confidence sources available",
            hedging=HedgingIntensity.MAXIMUM,
            display_indicator=DisplayIndicator.CRITICAL,
        )

    async def record_outcome(
        self,
        result_id: str,
        predicted_score: float,
        actual_correct: bool
    ) -> None:
        """Record outcome for calibration."""
        async with self._lock:
            if result_id not in self._calibration_data:
                self._calibration_data[result_id] = []
            self._calibration_data[result_id].append((predicted_score, actual_correct))

    def get_calibration_stats(self) -> Dict[str, Any]:
        """Get calibration statistics."""
        all_data = []
        for data in self._calibration_data.values():
            all_data.extend(data)

        if not all_data:
            return {"status": "no_data"}

        # Group by confidence buckets
        buckets: Dict[str, List[bool]] = {
            "0.0-0.2": [],
            "0.2-0.4": [],
            "0.4-0.6": [],
            "0.6-0.8": [],
            "0.8-1.0": [],
        }

        for score, correct in all_data:
            if score < 0.2:
                buckets["0.0-0.2"].append(correct)
            elif score < 0.4:
                buckets["0.2-0.4"].append(correct)
            elif score < 0.6:
                buckets["0.4-0.6"].append(correct)
            elif score < 0.8:
                buckets["0.6-0.8"].append(correct)
            else:
                buckets["0.8-1.0"].append(correct)

        stats = {}
        for bucket, outcomes in buckets.items():
            if outcomes:
                accuracy = sum(outcomes) / len(outcomes)
                stats[bucket] = {
                    "count": len(outcomes),
                    "accuracy": accuracy,
                }

        return stats


class LanguageHedger:
    """
    Maps confidence scores to appropriate language patterns.

    Provides templates and transformations for hedging
    language based on confidence levels.
    """

    # Hedging templates by intensity
    TEMPLATES = {
        HedgingIntensity.NONE: {
            "prefix": "",
            "verbs": ["is", "are", "shows", "demonstrates", "confirms", "proves"],
            "modifiers": ["clearly", "definitely", "certainly"],
            "connectors": ["therefore", "consequently", "as a result"],
        },
        HedgingIntensity.LIGHT: {
            "prefix": "",
            "verbs": ["indicates", "suggests", "points to", "implies"],
            "modifiers": ["likely", "probably", "generally"],
            "connectors": ["this suggests", "evidence indicates"],
        },
        HedgingIntensity.MODERATE: {
            "prefix": "It appears that ",
            "verbs": ["may indicate", "could suggest", "appears to show"],
            "modifiers": ["possibly", "potentially", "seemingly"],
            "connectors": ["this may mean", "it's possible that"],
        },
        HedgingIntensity.HEAVY: {
            "prefix": "It's possible that ",
            "verbs": ["might", "could", "may potentially"],
            "modifiers": ["perhaps", "conceivably", "tentatively"],
            "connectors": ["there's a chance that", "it might be that"],
        },
        HedgingIntensity.MAXIMUM: {
            "prefix": "It's unclear, but ",
            "verbs": ["cannot determine", "is uncertain", "remains unclear"],
            "modifiers": ["speculatively", "hypothetically"],
            "connectors": ["we cannot say for certain", "it's difficult to determine"],
        },
    }

    def __init__(self, scorer: Optional[ConfidenceScorer] = None):
        self.scorer = scorer or ConfidenceScorer()

    def hedge_statement(
        self,
        statement: str,
        confidence: ConfidenceResult
    ) -> str:
        """
        Apply hedging to a statement based on confidence.

        Args:
            statement: The statement to hedge
            confidence: Confidence result for the statement

        Returns:
            Hedged statement
        """
        template = self.TEMPLATES[confidence.hedging]

        # Apply prefix if any
        if template["prefix"]:
            # Lowercase first letter of statement if adding prefix
            if statement and statement[0].isupper():
                statement = statement[0].lower() + statement[1:]
            return template["prefix"] + statement

        return statement

    def get_hedging_verb(self, confidence: ConfidenceResult) -> str:
        """Get an appropriate verb for the confidence level."""
        template = self.TEMPLATES[confidence.hedging]
        return template["verbs"][0]

    def get_hedging_modifier(self, confidence: ConfidenceResult) -> str:
        """Get an appropriate modifier for the confidence level."""
        template = self.TEMPLATES[confidence.hedging]
        return template["modifiers"][0]

    def get_connector(self, confidence: ConfidenceResult) -> str:
        """Get an appropriate connector for the confidence level."""
        template = self.TEMPLATES[confidence.hedging]
        return template["connectors"][0]

    def format_with_confidence(
        self,
        statement: str,
        confidence: ConfidenceResult,
        include_score: bool = False
    ) -> str:
        """Format a statement with confidence indication."""
        hedged = self.hedge_statement(statement, confidence)

        if include_score:
            return f"{hedged} (confidence: {confidence.score:.0%})"

        return hedged

    def suggest_rewrites(
        self,
        statement: str,
        confidence: ConfidenceResult
    ) -> List[str]:
        """Suggest alternative phrasings based on confidence."""
        template = self.TEMPLATES[confidence.hedging]
        suggestions = []

        for verb in template["verbs"]:
            suggestions.append(f"This {verb} {statement.lower()}")

        for modifier in template["modifiers"]:
            suggestions.append(f"{modifier.capitalize()}, {statement.lower()}")

        return suggestions[:3]


@dataclass
class TransparencyRule:
    """A rule for displaying confidence transparency."""
    min_score: float
    max_score: float
    indicator: DisplayIndicator
    show_tooltip: bool
    show_score: bool
    css_class: str
    icon: Optional[str] = None
    warning_message: Optional[str] = None


class TransparencyDisplay:
    """
    Manages UI transparency rules for confidence display.

    Determines how confidence should be visually communicated
    to users based on score thresholds and context.
    """

    DEFAULT_RULES = [
        TransparencyRule(
            min_score=0.8, max_score=1.0,
            indicator=DisplayIndicator.NONE,
            show_tooltip=False, show_score=False,
            css_class="confidence-high",
        ),
        TransparencyRule(
            min_score=0.6, max_score=0.8,
            indicator=DisplayIndicator.SUBTLE,
            show_tooltip=True, show_score=False,
            css_class="confidence-medium-high",
            icon="info-circle",
        ),
        TransparencyRule(
            min_score=0.4, max_score=0.6,
            indicator=DisplayIndicator.MODERATE,
            show_tooltip=True, show_score=True,
            css_class="confidence-medium",
            icon="question-circle",
        ),
        TransparencyRule(
            min_score=0.2, max_score=0.4,
            indicator=DisplayIndicator.PROMINENT,
            show_tooltip=True, show_score=True,
            css_class="confidence-low",
            icon="exclamation-triangle",
            warning_message="This content has low confidence and may be inaccurate.",
        ),
        TransparencyRule(
            min_score=0.0, max_score=0.2,
            indicator=DisplayIndicator.CRITICAL,
            show_tooltip=True, show_score=True,
            css_class="confidence-very-low",
            icon="exclamation-circle",
            warning_message="This content has very low confidence. Please verify before use.",
        ),
    ]

    def __init__(self, rules: Optional[List[TransparencyRule]] = None):
        self.rules = rules or self.DEFAULT_RULES

    def get_display_info(
        self,
        confidence: ConfidenceResult
    ) -> Dict[str, Any]:
        """Get display information for a confidence result."""
        rule = self._find_rule(confidence.score)

        return {
            "indicator": rule.indicator.value,
            "show_tooltip": rule.show_tooltip,
            "show_score": rule.show_score,
            "css_class": rule.css_class,
            "icon": rule.icon,
            "warning_message": rule.warning_message,
            "tooltip_content": self._generate_tooltip(confidence) if rule.show_tooltip else None,
            "score_display": f"{confidence.score:.0%}" if rule.show_score else None,
        }

    def should_show_indicator(self, confidence: ConfidenceResult) -> bool:
        """Check if an indicator should be shown."""
        rule = self._find_rule(confidence.score)
        return rule.indicator != DisplayIndicator.NONE

    def should_block_action(
        self,
        confidence: ConfidenceResult,
        action_type: str = "default"
    ) -> bool:
        """Check if an action should be blocked due to low confidence."""
        # Critical confidence blocks destructive actions
        if confidence.display_indicator == DisplayIndicator.CRITICAL:
            if action_type in ["delete", "publish", "send", "submit"]:
                return True
        return False

    def get_confirmation_required(
        self,
        confidence: ConfidenceResult,
        action_type: str = "default"
    ) -> bool:
        """Check if user confirmation is required."""
        if confidence.score < 0.5:
            if action_type in ["save", "apply", "execute"]:
                return True
        if confidence.score < 0.3:
            return True
        return False

    def _find_rule(self, score: float) -> TransparencyRule:
        """Find the applicable rule for a score."""
        for rule in self.rules:
            if rule.min_score <= score < rule.max_score:
                return rule
        # Default to last rule (lowest confidence)
        return self.rules[-1]

    def _generate_tooltip(self, confidence: ConfidenceResult) -> str:
        """Generate tooltip content for confidence."""
        parts = [
            f"Confidence: {confidence.score:.0%}",
            f"Level: {confidence.level.value.replace('_', ' ').title()}",
        ]

        if confidence.sources:
            parts.append(f"Based on {len(confidence.sources)} source(s)")

        if confidence.reasoning:
            # Take first line of reasoning
            first_line = confidence.reasoning.split("\n")[0]
            parts.append(first_line)

        return " | ".join(parts)


@dataclass
class ConflictConfidencePolicy:
    """Policy for confidence-based conflict resolution."""
    # Threshold above which AI changes are auto-accepted
    auto_accept_threshold: float = 0.9
    # Threshold below which AI changes require confirmation
    require_confirmation_threshold: float = 0.7
    # Threshold below which AI changes are rejected
    auto_reject_threshold: float = 0.3
    # Human edits always have this minimum confidence
    human_minimum_confidence: float = 0.85
    # Whether to prefer higher confidence in conflicts
    prefer_higher_confidence: bool = True


class ConflictConfidenceResolver:
    """
    Integrates confidence scoring with conflict resolution.

    Provides confidence-aware strategies for resolving
    conflicts between human and AI edits.
    """

    def __init__(
        self,
        scorer: Optional[ConfidenceScorer] = None,
        policy: Optional[ConflictConfidencePolicy] = None
    ):
        self.scorer = scorer or ConfidenceScorer()
        self.policy = policy or ConflictConfidencePolicy()

    def should_auto_accept_ai_change(
        self,
        ai_confidence: ConfidenceResult
    ) -> bool:
        """Check if AI change should be auto-accepted."""
        return ai_confidence.score >= self.policy.auto_accept_threshold

    def should_require_confirmation(
        self,
        ai_confidence: ConfidenceResult
    ) -> bool:
        """Check if AI change requires user confirmation."""
        return (
            ai_confidence.score < self.policy.require_confirmation_threshold and
            ai_confidence.score >= self.policy.auto_reject_threshold
        )

    def should_auto_reject(
        self,
        ai_confidence: ConfidenceResult
    ) -> bool:
        """Check if AI change should be auto-rejected."""
        return ai_confidence.score < self.policy.auto_reject_threshold

    def resolve_conflict(
        self,
        human_confidence: ConfidenceResult,
        ai_confidence: ConfidenceResult
    ) -> str:
        """
        Resolve a conflict between human and AI edits.

        Returns:
            "human", "ai", or "manual" for manual resolution
        """
        # Ensure human has minimum confidence
        human_score = max(
            human_confidence.score,
            self.policy.human_minimum_confidence
        )

        if self.policy.prefer_higher_confidence:
            # If AI confidence is very high and beats human
            if ai_confidence.score >= self.policy.auto_accept_threshold:
                if ai_confidence.score > human_score:
                    return "ai"

            # Human always wins if AI confidence is low
            if ai_confidence.score < self.policy.require_confirmation_threshold:
                return "human"

            # Close scores require manual resolution
            if abs(ai_confidence.score - human_score) < 0.1:
                return "manual"

            return "human" if human_score > ai_confidence.score else "ai"

        # Default: human always wins
        return "human"

    def get_resolution_reasoning(
        self,
        human_confidence: ConfidenceResult,
        ai_confidence: ConfidenceResult,
        resolution: str
    ) -> str:
        """Get explanation for conflict resolution."""
        human_score = max(
            human_confidence.score,
            self.policy.human_minimum_confidence
        )

        if resolution == "human":
            return (
                f"Human edit preferred (confidence: {human_score:.0%}) "
                f"over AI suggestion (confidence: {ai_confidence.score:.0%})"
            )
        elif resolution == "ai":
            return (
                f"AI suggestion accepted (confidence: {ai_confidence.score:.0%}) "
                f"as it exceeds human edit (confidence: {human_score:.0%})"
            )
        else:
            return (
                f"Manual resolution required. Human: {human_score:.0%}, "
                f"AI: {ai_confidence.score:.0%}"
            )


# Global instance management
_confidence_scorer: Optional[ConfidenceScorer] = None
_language_hedger: Optional[LanguageHedger] = None
_transparency_display: Optional[TransparencyDisplay] = None


def get_confidence_scorer() -> Optional[ConfidenceScorer]:
    """Get the global confidence scorer."""
    return _confidence_scorer


def set_confidence_scorer(scorer: ConfidenceScorer) -> None:
    """Set the global confidence scorer."""
    global _confidence_scorer
    _confidence_scorer = scorer


def reset_confidence_scorer() -> None:
    """Reset the global confidence scorer."""
    global _confidence_scorer
    _confidence_scorer = None


def get_language_hedger() -> Optional[LanguageHedger]:
    """Get the global language hedger."""
    return _language_hedger


def set_language_hedger(hedger: LanguageHedger) -> None:
    """Set the global language hedger."""
    global _language_hedger
    _language_hedger = hedger


def get_transparency_display() -> Optional[TransparencyDisplay]:
    """Get the global transparency display."""
    return _transparency_display


def set_transparency_display(display: TransparencyDisplay) -> None:
    """Set the global transparency display."""
    global _transparency_display
    _transparency_display = display
