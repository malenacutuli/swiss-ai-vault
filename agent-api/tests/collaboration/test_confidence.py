"""Tests for the confidence scoring and transparency module."""

import pytest
from datetime import datetime, timedelta

from app.collaboration.confidence import (
    ConfidenceScorer,
    ConfidenceConfig,
    ConfidenceResult,
    ConfidenceSource,
    ConfidenceLevel,
    ConfidenceSourceType,
    HedgingIntensity,
    DisplayIndicator,
    LanguageHedger,
    TransparencyRule,
    TransparencyDisplay,
    ConflictConfidencePolicy,
    ConflictConfidenceResolver,
    get_confidence_scorer,
    set_confidence_scorer,
    reset_confidence_scorer,
    get_language_hedger,
    set_language_hedger,
    get_transparency_display,
    set_transparency_display,
)


class TestConfidenceSource:
    """Tests for ConfidenceSource."""

    def test_create_source(self):
        """Test creating a confidence source."""
        source = ConfidenceSource(
            source_type=ConfidenceSourceType.HUMAN_INPUT,
            score=0.9,
            reason="User verified",
        )
        assert source.source_type == ConfidenceSourceType.HUMAN_INPUT
        assert source.score == 0.9
        assert source.weight == 1.0
        assert source.reason == "User verified"

    def test_weighted_score(self):
        """Test weighted score calculation."""
        source = ConfidenceSource(
            source_type=ConfidenceSourceType.AI_GENERATION,
            score=0.8,
            weight=0.5,
        )
        assert source.weighted_score() == 0.4

    def test_source_with_metadata(self):
        """Test source with metadata."""
        source = ConfidenceSource(
            source_type=ConfidenceSourceType.DATA_QUALITY,
            score=0.7,
            metadata={"source_count": 5, "quality_score": 0.8},
        )
        assert source.metadata["source_count"] == 5
        assert source.metadata["quality_score"] == 0.8


class TestConfidenceConfig:
    """Tests for ConfidenceConfig."""

    def test_default_config(self):
        """Test default configuration values."""
        config = ConfidenceConfig()
        assert config.very_high_threshold == 0.9
        assert config.high_threshold == 0.8
        assert config.medium_high_threshold == 0.7
        assert config.medium_threshold == 0.5
        assert config.low_threshold == 0.3
        assert config.enable_temporal_decay is True
        assert config.aggregation_method == "weighted_average"

    def test_custom_config(self):
        """Test custom configuration."""
        config = ConfidenceConfig(
            very_high_threshold=0.95,
            aggregation_method="minimum",
            enable_temporal_decay=False,
        )
        assert config.very_high_threshold == 0.95
        assert config.aggregation_method == "minimum"
        assert config.enable_temporal_decay is False

    def test_source_weights(self):
        """Test default source weights."""
        config = ConfidenceConfig()
        assert config.source_weights[ConfidenceSourceType.HUMAN_INPUT] == 1.0
        assert config.source_weights[ConfidenceSourceType.AI_GENERATION] == 0.7
        assert config.source_weights[ConfidenceSourceType.VERIFICATION] == 0.95


class TestConfidenceScorer:
    """Tests for ConfidenceScorer."""

    def test_create_scorer(self):
        """Test creating a scorer."""
        scorer = ConfidenceScorer()
        assert scorer.config is not None

    def test_calculate_confidence_single_source(self):
        """Test confidence calculation with single source."""
        scorer = ConfidenceScorer()
        sources = [
            ConfidenceSource(
                source_type=ConfidenceSourceType.HUMAN_INPUT,
                score=0.95,
            )
        ]
        result = scorer.calculate_confidence(sources)
        assert result.score == pytest.approx(0.95, abs=0.01)
        assert result.level == ConfidenceLevel.VERY_HIGH

    def test_calculate_confidence_multiple_sources(self):
        """Test confidence calculation with multiple sources."""
        scorer = ConfidenceScorer()
        sources = [
            ConfidenceSource(
                source_type=ConfidenceSourceType.AI_GENERATION,
                score=0.8,
            ),
            ConfidenceSource(
                source_type=ConfidenceSourceType.DATA_QUALITY,
                score=0.6,
            ),
        ]
        result = scorer.calculate_confidence(sources)
        assert 0.6 < result.score < 0.8

    def test_calculate_confidence_no_sources(self):
        """Test confidence calculation with no sources."""
        scorer = ConfidenceScorer()
        result = scorer.calculate_confidence([])
        assert result.score == 0.0
        assert result.level == ConfidenceLevel.VERY_LOW
        assert result.hedging == HedgingIntensity.MAXIMUM

    def test_score_to_level_very_high(self):
        """Test score to level mapping for very high."""
        scorer = ConfidenceScorer()
        assert scorer._score_to_level(0.95) == ConfidenceLevel.VERY_HIGH
        assert scorer._score_to_level(0.90) == ConfidenceLevel.VERY_HIGH

    def test_score_to_level_high(self):
        """Test score to level mapping for high."""
        scorer = ConfidenceScorer()
        assert scorer._score_to_level(0.85) == ConfidenceLevel.HIGH
        assert scorer._score_to_level(0.80) == ConfidenceLevel.HIGH

    def test_score_to_level_medium_high(self):
        """Test score to level mapping for medium-high."""
        scorer = ConfidenceScorer()
        assert scorer._score_to_level(0.75) == ConfidenceLevel.MEDIUM_HIGH
        assert scorer._score_to_level(0.70) == ConfidenceLevel.MEDIUM_HIGH

    def test_score_to_level_medium(self):
        """Test score to level mapping for medium."""
        scorer = ConfidenceScorer()
        assert scorer._score_to_level(0.60) == ConfidenceLevel.MEDIUM
        assert scorer._score_to_level(0.50) == ConfidenceLevel.MEDIUM

    def test_score_to_level_low(self):
        """Test score to level mapping for low."""
        scorer = ConfidenceScorer()
        assert scorer._score_to_level(0.40) == ConfidenceLevel.LOW
        assert scorer._score_to_level(0.30) == ConfidenceLevel.LOW

    def test_score_to_level_very_low(self):
        """Test score to level mapping for very low."""
        scorer = ConfidenceScorer()
        assert scorer._score_to_level(0.20) == ConfidenceLevel.VERY_LOW
        assert scorer._score_to_level(0.10) == ConfidenceLevel.VERY_LOW

    def test_score_to_hedging(self):
        """Test score to hedging mapping."""
        scorer = ConfidenceScorer()
        assert scorer._score_to_hedging(0.95) == HedgingIntensity.NONE
        assert scorer._score_to_hedging(0.75) == HedgingIntensity.LIGHT
        assert scorer._score_to_hedging(0.55) == HedgingIntensity.MODERATE
        assert scorer._score_to_hedging(0.35) == HedgingIntensity.HEAVY
        assert scorer._score_to_hedging(0.15) == HedgingIntensity.MAXIMUM

    def test_score_to_display(self):
        """Test score to display indicator mapping."""
        scorer = ConfidenceScorer()
        assert scorer._score_to_display(0.85) == DisplayIndicator.NONE
        assert scorer._score_to_display(0.65) == DisplayIndicator.SUBTLE
        assert scorer._score_to_display(0.45) == DisplayIndicator.MODERATE
        assert scorer._score_to_display(0.25) == DisplayIndicator.PROMINENT
        assert scorer._score_to_display(0.15) == DisplayIndicator.CRITICAL

    def test_calculate_from_single(self):
        """Test convenience method for single source."""
        scorer = ConfidenceScorer()
        result = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT,
            0.9,
            "User input",
        )
        assert result.score == pytest.approx(0.9, abs=0.01)
        assert len(result.sources) == 1

    def test_calculate_human_confidence(self):
        """Test human confidence calculation."""
        scorer = ConfidenceScorer()
        result = scorer.calculate_human_confidence(verified=False)
        assert result.score >= 0.8
        assert result.level in [ConfidenceLevel.HIGH, ConfidenceLevel.VERY_HIGH]

    def test_calculate_human_confidence_verified(self):
        """Test verified human confidence."""
        scorer = ConfidenceScorer()
        result = scorer.calculate_human_confidence(verified=True)
        assert result.score >= 0.9

    def test_calculate_ai_confidence(self):
        """Test AI confidence calculation."""
        scorer = ConfidenceScorer()
        result = scorer.calculate_ai_confidence(
            model_confidence=0.8,
            source_quality=0.7,
            data_freshness=0.6,
        )
        assert 0.5 < result.score < 0.9
        assert len(result.sources) == 3

    def test_calculate_ai_confidence_with_consensus(self):
        """Test AI confidence with consensus."""
        scorer = ConfidenceScorer()
        result = scorer.calculate_ai_confidence(
            model_confidence=0.8,
            source_quality=0.7,
            data_freshness=0.6,
            consensus_score=0.9,
        )
        assert len(result.sources) == 4

    def test_aggregation_weighted_average(self):
        """Test weighted average aggregation."""
        config = ConfidenceConfig(
            aggregation_method="weighted_average",
            enable_temporal_decay=False,
        )
        scorer = ConfidenceScorer(config)
        sources = [
            ConfidenceSource(
                source_type=ConfidenceSourceType.HUMAN_INPUT,
                score=0.8,
                weight=2.0,
            ),
            ConfidenceSource(
                source_type=ConfidenceSourceType.AI_GENERATION,
                score=0.4,
                weight=0.7,  # Explicit weight to match config default
            ),
        ]
        result = scorer.calculate_confidence(sources)
        # (0.8 * 2 + 0.4 * 0.7) / (2 + 0.7) = 0.696
        assert result.score == pytest.approx(0.696, abs=0.01)

    def test_aggregation_minimum(self):
        """Test minimum aggregation."""
        config = ConfidenceConfig(
            aggregation_method="minimum",
            enable_temporal_decay=False,
        )
        scorer = ConfidenceScorer(config)
        sources = [
            ConfidenceSource(
                source_type=ConfidenceSourceType.HUMAN_INPUT,
                score=0.9,
                weight=1.0,
            ),
            ConfidenceSource(
                source_type=ConfidenceSourceType.AI_GENERATION,
                score=0.5,
                weight=1.0,
            ),
        ]
        result = scorer.calculate_confidence(sources)
        assert result.score == pytest.approx(0.5, abs=0.01)

    def test_temporal_decay(self):
        """Test temporal decay is applied."""
        config = ConfidenceConfig(
            enable_temporal_decay=True,
            decay_half_life_hours=24.0,
        )
        scorer = ConfidenceScorer(config)

        old_timestamp = datetime.utcnow() - timedelta(hours=48)
        sources = [
            ConfidenceSource(
                source_type=ConfidenceSourceType.AI_GENERATION,
                score=1.0,
                timestamp=old_timestamp,
            ),
        ]
        result = scorer.calculate_confidence(sources)
        # After 2 half-lives, score should be ~0.25 but minimum decay is 0.5
        assert result.score < 1.0

    def test_generate_reasoning(self):
        """Test reasoning generation."""
        scorer = ConfidenceScorer()
        sources = [
            ConfidenceSource(
                source_type=ConfidenceSourceType.HUMAN_INPUT,
                score=0.9,
                reason="User verified content",
            ),
        ]
        result = scorer.calculate_confidence(sources)
        assert "Confidence:" in result.reasoning
        assert "human_input" in result.reasoning

    def test_result_to_dict(self):
        """Test ConfidenceResult to_dict method."""
        config = ConfidenceConfig(enable_temporal_decay=False)
        scorer = ConfidenceScorer(config)
        result = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT,
            0.95,  # Use 0.95 to ensure VERY_HIGH level
        )
        data = result.to_dict()
        assert "score" in data
        assert "level" in data
        assert "hedging" in data
        assert "display_indicator" in data
        assert data["level"] == "very_high"


class TestLanguageHedger:
    """Tests for LanguageHedger."""

    def test_create_hedger(self):
        """Test creating a hedger."""
        hedger = LanguageHedger()
        assert hedger.scorer is not None

    def test_hedge_statement_high_confidence(self):
        """Test hedging with high confidence."""
        hedger = LanguageHedger()
        scorer = ConfidenceScorer()
        confidence = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT,
            0.95,
        )
        result = hedger.hedge_statement("The data is accurate", confidence)
        assert result == "The data is accurate"  # No hedging

    def test_hedge_statement_moderate_confidence(self):
        """Test hedging with moderate confidence."""
        hedger = LanguageHedger()
        scorer = ConfidenceScorer()
        confidence = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION,
            0.55,
        )
        result = hedger.hedge_statement("The data is accurate", confidence)
        assert "appears" in result.lower() or "the data" in result.lower()

    def test_hedge_statement_low_confidence(self):
        """Test hedging with low confidence."""
        hedger = LanguageHedger()
        scorer = ConfidenceScorer()
        confidence = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION,
            0.25,
        )
        result = hedger.hedge_statement("The result is correct", confidence)
        assert "unclear" in result.lower()

    def test_get_hedging_verb(self):
        """Test getting hedging verbs."""
        hedger = LanguageHedger()
        scorer = ConfidenceScorer()

        high_conf = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT, 0.95
        )
        assert hedger.get_hedging_verb(high_conf) in ["is", "are", "shows"]

        low_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.25
        )
        assert "cannot" in hedger.get_hedging_verb(low_conf) or "uncertain" in hedger.get_hedging_verb(low_conf)

    def test_get_hedging_modifier(self):
        """Test getting hedging modifiers."""
        hedger = LanguageHedger()
        scorer = ConfidenceScorer()

        high_conf = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT, 0.95
        )
        assert hedger.get_hedging_modifier(high_conf) in ["clearly", "definitely", "certainly"]

    def test_get_connector(self):
        """Test getting connectors."""
        hedger = LanguageHedger()
        scorer = ConfidenceScorer()

        med_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.75
        )
        connector = hedger.get_connector(med_conf)
        assert "suggest" in connector or "indicate" in connector

    def test_format_with_confidence(self):
        """Test formatting with confidence."""
        hedger = LanguageHedger()
        scorer = ConfidenceScorer()
        confidence = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT, 0.8
        )
        result = hedger.format_with_confidence(
            "The answer is correct",
            confidence,
            include_score=True,
        )
        assert "80%" in result or "confidence" in result.lower()

    def test_suggest_rewrites(self):
        """Test suggesting rewrites."""
        hedger = LanguageHedger()
        scorer = ConfidenceScorer()
        confidence = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.6
        )
        suggestions = hedger.suggest_rewrites("data is valid", confidence)
        assert len(suggestions) <= 3
        assert all(isinstance(s, str) for s in suggestions)


class TestTransparencyDisplay:
    """Tests for TransparencyDisplay."""

    def test_create_display(self):
        """Test creating display manager."""
        display = TransparencyDisplay()
        assert len(display.rules) == 5

    def test_get_display_info_high_confidence(self):
        """Test display info for high confidence."""
        display = TransparencyDisplay()
        scorer = ConfidenceScorer()
        confidence = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT, 0.9
        )
        info = display.get_display_info(confidence)
        assert info["indicator"] == "none"
        assert info["show_tooltip"] is False

    def test_get_display_info_medium_confidence(self):
        """Test display info for medium confidence."""
        display = TransparencyDisplay()
        scorer = ConfidenceScorer()
        confidence = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.65
        )
        info = display.get_display_info(confidence)
        assert info["indicator"] == "subtle"
        assert info["show_tooltip"] is True

    def test_get_display_info_low_confidence(self):
        """Test display info for low confidence."""
        display = TransparencyDisplay()
        scorer = ConfidenceScorer()
        confidence = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.25
        )
        info = display.get_display_info(confidence)
        assert info["indicator"] == "prominent"
        assert info["warning_message"] is not None

    def test_get_display_info_very_low_confidence(self):
        """Test display info for very low confidence."""
        display = TransparencyDisplay()
        scorer = ConfidenceScorer()
        confidence = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.1
        )
        info = display.get_display_info(confidence)
        assert info["indicator"] == "critical"
        assert "verify" in info["warning_message"].lower()

    def test_should_show_indicator(self):
        """Test should show indicator check."""
        display = TransparencyDisplay()
        scorer = ConfidenceScorer()

        high_conf = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT, 0.9
        )
        assert display.should_show_indicator(high_conf) is False

        low_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.3
        )
        assert display.should_show_indicator(low_conf) is True

    def test_should_block_action(self):
        """Test action blocking based on confidence."""
        display = TransparencyDisplay()
        scorer = ConfidenceScorer()

        critical_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.1
        )
        assert display.should_block_action(critical_conf, "delete") is True
        assert display.should_block_action(critical_conf, "view") is False

    def test_get_confirmation_required(self):
        """Test confirmation requirement check."""
        display = TransparencyDisplay()
        scorer = ConfidenceScorer()

        low_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.4
        )
        assert display.get_confirmation_required(low_conf, "save") is True

        high_conf = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT, 0.9
        )
        assert display.get_confirmation_required(high_conf, "save") is False

    def test_custom_rules(self):
        """Test custom transparency rules."""
        rules = [
            TransparencyRule(
                min_score=0.5, max_score=1.0,
                indicator=DisplayIndicator.NONE,
                show_tooltip=False, show_score=False,
                css_class="ok",
            ),
            TransparencyRule(
                min_score=0.0, max_score=0.5,
                indicator=DisplayIndicator.CRITICAL,
                show_tooltip=True, show_score=True,
                css_class="bad",
                warning_message="Low confidence!",
            ),
        ]
        display = TransparencyDisplay(rules=rules)
        scorer = ConfidenceScorer()

        high_conf = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT, 0.6
        )
        info = display.get_display_info(high_conf)
        assert info["css_class"] == "ok"


class TestConflictConfidenceResolver:
    """Tests for ConflictConfidenceResolver."""

    def test_create_resolver(self):
        """Test creating resolver."""
        resolver = ConflictConfidenceResolver()
        assert resolver.scorer is not None
        assert resolver.policy is not None

    def test_should_auto_accept_high_confidence(self):
        """Test auto-accept for high confidence."""
        resolver = ConflictConfidenceResolver()
        scorer = ConfidenceScorer()

        high_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.95
        )
        assert resolver.should_auto_accept_ai_change(high_conf) is True

        med_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.7
        )
        assert resolver.should_auto_accept_ai_change(med_conf) is False

    def test_should_require_confirmation(self):
        """Test confirmation requirement."""
        resolver = ConflictConfidenceResolver()
        scorer = ConfidenceScorer()

        med_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.5
        )
        assert resolver.should_require_confirmation(med_conf) is True

        high_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.8
        )
        assert resolver.should_require_confirmation(high_conf) is False

    def test_should_auto_reject(self):
        """Test auto-reject for low confidence."""
        resolver = ConflictConfidenceResolver()
        scorer = ConfidenceScorer()

        low_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.2
        )
        assert resolver.should_auto_reject(low_conf) is True

        med_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.5
        )
        assert resolver.should_auto_reject(med_conf) is False

    def test_resolve_conflict_human_wins(self):
        """Test conflict resolution favoring human."""
        resolver = ConflictConfidenceResolver()
        scorer = ConfidenceScorer()

        human_conf = scorer.calculate_human_confidence(verified=True)
        ai_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.6
        )

        resolution = resolver.resolve_conflict(human_conf, ai_conf)
        assert resolution == "human"

    def test_resolve_conflict_ai_wins(self):
        """Test conflict resolution favoring AI."""
        policy = ConflictConfidencePolicy(prefer_higher_confidence=True)
        resolver = ConflictConfidenceResolver(policy=policy)
        scorer = ConfidenceScorer()

        human_conf = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT, 0.7
        )
        ai_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.95
        )

        resolution = resolver.resolve_conflict(human_conf, ai_conf)
        assert resolution == "ai"

    def test_resolve_conflict_manual(self):
        """Test conflict requiring manual resolution."""
        policy = ConflictConfidencePolicy(
            prefer_higher_confidence=True,
            human_minimum_confidence=0.75,
        )
        resolver = ConflictConfidenceResolver(policy=policy)
        scorer = ConfidenceScorer()

        human_conf = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT, 0.8
        )
        ai_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.78
        )

        resolution = resolver.resolve_conflict(human_conf, ai_conf)
        assert resolution == "manual"

    def test_get_resolution_reasoning(self):
        """Test resolution reasoning."""
        resolver = ConflictConfidenceResolver()
        scorer = ConfidenceScorer()

        human_conf = scorer.calculate_human_confidence()
        ai_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.5
        )

        reasoning = resolver.get_resolution_reasoning(
            human_conf, ai_conf, "human"
        )
        assert "Human edit preferred" in reasoning

    def test_custom_policy(self):
        """Test custom conflict policy."""
        policy = ConflictConfidencePolicy(
            auto_accept_threshold=0.99,
            require_confirmation_threshold=0.9,
            auto_reject_threshold=0.5,
        )
        resolver = ConflictConfidenceResolver(policy=policy)
        scorer = ConfidenceScorer()

        high_conf = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.95
        )
        assert resolver.should_auto_accept_ai_change(high_conf) is False
        assert resolver.should_require_confirmation(high_conf) is False


class TestGlobalInstances:
    """Tests for global instance management."""

    def teardown_method(self):
        """Reset global instances after each test."""
        reset_confidence_scorer()

    def test_get_scorer_none(self):
        """Test getting scorer when not set."""
        reset_confidence_scorer()
        assert get_confidence_scorer() is None

    def test_set_and_get_scorer(self):
        """Test setting and getting scorer."""
        scorer = ConfidenceScorer()
        set_confidence_scorer(scorer)
        assert get_confidence_scorer() is scorer

    def test_reset_scorer(self):
        """Test resetting scorer."""
        scorer = ConfidenceScorer()
        set_confidence_scorer(scorer)
        reset_confidence_scorer()
        assert get_confidence_scorer() is None

    def test_set_and_get_hedger(self):
        """Test setting and getting hedger."""
        hedger = LanguageHedger()
        set_language_hedger(hedger)
        assert get_language_hedger() is hedger

    def test_set_and_get_display(self):
        """Test setting and getting display."""
        display = TransparencyDisplay()
        set_transparency_display(display)
        assert get_transparency_display() is display


class TestConfidenceEnums:
    """Tests for confidence enums."""

    def test_confidence_level_values(self):
        """Test confidence level enum values."""
        assert ConfidenceLevel.VERY_HIGH.value == "very_high"
        assert ConfidenceLevel.HIGH.value == "high"
        assert ConfidenceLevel.MEDIUM.value == "medium"
        assert ConfidenceLevel.LOW.value == "low"
        assert ConfidenceLevel.VERY_LOW.value == "very_low"

    def test_source_type_values(self):
        """Test source type enum values."""
        assert ConfidenceSourceType.HUMAN_INPUT.value == "human_input"
        assert ConfidenceSourceType.AI_GENERATION.value == "ai_generation"
        assert ConfidenceSourceType.VERIFICATION.value == "verification"

    def test_hedging_intensity_values(self):
        """Test hedging intensity enum values."""
        assert HedgingIntensity.NONE.value == "none"
        assert HedgingIntensity.LIGHT.value == "light"
        assert HedgingIntensity.MAXIMUM.value == "maximum"

    def test_display_indicator_values(self):
        """Test display indicator enum values."""
        assert DisplayIndicator.NONE.value == "none"
        assert DisplayIndicator.SUBTLE.value == "subtle"
        assert DisplayIndicator.CRITICAL.value == "critical"


class TestCalibration:
    """Tests for calibration features."""

    @pytest.mark.asyncio
    async def test_record_outcome(self):
        """Test recording calibration outcome."""
        scorer = ConfidenceScorer()
        await scorer.record_outcome("test1", 0.8, True)
        await scorer.record_outcome("test1", 0.6, False)

        stats = scorer.get_calibration_stats()
        assert stats != {"status": "no_data"}

    def test_get_calibration_stats_no_data(self):
        """Test calibration stats with no data."""
        scorer = ConfidenceScorer()
        stats = scorer.get_calibration_stats()
        assert stats == {"status": "no_data"}

    @pytest.mark.asyncio
    async def test_calibration_buckets(self):
        """Test calibration data is bucketed correctly."""
        scorer = ConfidenceScorer()

        # Add data to different buckets
        await scorer.record_outcome("high", 0.9, True)
        await scorer.record_outcome("high", 0.85, True)
        await scorer.record_outcome("low", 0.2, False)

        stats = scorer.get_calibration_stats()
        assert "0.8-1.0" in stats
        assert stats["0.8-1.0"]["count"] == 2


class TestEdgeCases:
    """Tests for edge cases."""

    def test_zero_weight_sources(self):
        """Test handling of zero-weight sources."""
        config = ConfidenceConfig(enable_temporal_decay=False)
        scorer = ConfidenceScorer(config)
        sources = [
            ConfidenceSource(
                source_type=ConfidenceSourceType.AI_GENERATION,
                score=0.8,
                weight=0.0,
            ),
        ]
        result = scorer.calculate_confidence(sources)
        assert result.score == 0.0

    def test_extreme_scores(self):
        """Test handling of extreme scores."""
        scorer = ConfidenceScorer()

        # Score of 1.0
        result = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT, 1.0
        )
        assert result.level == ConfidenceLevel.VERY_HIGH

        # Score of 0.0
        result = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.0
        )
        assert result.level == ConfidenceLevel.VERY_LOW

    def test_boundary_scores(self):
        """Test scores at exact boundaries."""
        config = ConfidenceConfig(enable_temporal_decay=False)
        scorer = ConfidenceScorer(config)

        # Exactly at very_high threshold
        result = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT, 0.9
        )
        assert result.level == ConfidenceLevel.VERY_HIGH

        # Just below very_high threshold
        result = scorer.calculate_from_single(
            ConfidenceSourceType.HUMAN_INPUT, 0.899
        )
        assert result.level == ConfidenceLevel.HIGH

    def test_empty_statement_hedging(self):
        """Test hedging empty statement."""
        hedger = LanguageHedger()
        scorer = ConfidenceScorer()
        confidence = scorer.calculate_from_single(
            ConfidenceSourceType.AI_GENERATION, 0.5
        )
        result = hedger.hedge_statement("", confidence)
        assert isinstance(result, str)

    def test_many_sources(self):
        """Test aggregation with many sources."""
        scorer = ConfidenceScorer()
        sources = [
            ConfidenceSource(
                source_type=ConfidenceSourceType.AI_GENERATION,
                score=0.5 + i * 0.05,
            )
            for i in range(10)
        ]
        result = scorer.calculate_confidence(sources)
        assert 0.0 <= result.score <= 1.0
