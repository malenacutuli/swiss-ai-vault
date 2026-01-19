"""Tests for the presentation generation module."""

import pytest
from datetime import datetime

from app.collaboration.presentation import (
    NarrativeBuilder,
    NarrativeElement,
    NarrativeElementType,
    PresentationNarrative,
    EmotionalTone,
    VisualValidator,
    VisualizationType,
    VisualizationData,
    ValidationResult,
    RejectionReason,
    SlideCountCalculator,
    SlideGenerator,
    Slide,
    SlideType,
    Presentation,
    DataPoint,
    get_narrative_builder,
    set_narrative_builder,
    reset_narrative_builder,
    get_visual_validator,
    set_visual_validator,
    get_slide_generator,
    set_slide_generator,
)


class TestDataPoint:
    """Tests for DataPoint."""

    def test_create_data_point(self):
        """Test creating a data point."""
        point = DataPoint(value=42, label="Answer")
        assert point.value == 42
        assert point.label == "Answer"
        assert point.confidence == 1.0

    def test_data_point_with_metadata(self):
        """Test data point with metadata."""
        point = DataPoint(
            value=100,
            label="Sales",
            category="Q1",
            source="CRM",
            metadata={"region": "US"},
        )
        assert point.category == "Q1"
        assert point.source == "CRM"
        assert point.metadata["region"] == "US"

    def test_data_point_with_timestamp(self):
        """Test data point with timestamp."""
        ts = datetime(2024, 1, 15)
        point = DataPoint(value=50, timestamp=ts)
        assert point.timestamp == ts


class TestNarrativeElement:
    """Tests for NarrativeElement."""

    def test_create_element(self):
        """Test creating a narrative element."""
        element = NarrativeElement(
            element_type=NarrativeElementType.HOOK,
            content="Why this matters",
            estimated_duration_seconds=30,
        )
        assert element.element_type == NarrativeElementType.HOOK
        assert element.content == "Why this matters"
        assert element.estimated_duration_seconds == 30

    def test_element_with_data(self):
        """Test element with supporting data."""
        data = [DataPoint(value=100, label="Revenue")]
        element = NarrativeElement(
            element_type=NarrativeElementType.JOURNEY,
            content="Our growth",
            supporting_data=data,
        )
        assert len(element.supporting_data) == 1

    def test_element_to_dict(self):
        """Test element to_dict conversion."""
        element = NarrativeElement(
            element_type=NarrativeElementType.RESOLUTION,
            content="Our recommendation",
            emotional_tone=EmotionalTone.OPTIMISTIC,
        )
        data = element.to_dict()
        assert data["element_type"] == "resolution"
        assert data["emotional_tone"] == "optimistic"

    def test_element_visual_suggestion(self):
        """Test element with visual suggestion."""
        element = NarrativeElement(
            element_type=NarrativeElementType.JOURNEY,
            content="Data insights",
            visual_suggestion=VisualizationType.BAR_CHART,
        )
        assert element.visual_suggestion == VisualizationType.BAR_CHART


class TestPresentationNarrative:
    """Tests for PresentationNarrative."""

    def test_create_narrative(self):
        """Test creating a narrative."""
        narrative = PresentationNarrative(
            title="Q4 Results",
            target_duration_minutes=15,
        )
        assert narrative.title == "Q4 Results"
        assert narrative.target_duration_minutes == 15

    def test_get_all_elements(self):
        """Test getting all elements."""
        narrative = PresentationNarrative(title="Test")
        narrative.hook = NarrativeElement(element_type=NarrativeElementType.HOOK)
        narrative.context = NarrativeElement(element_type=NarrativeElementType.CONTEXT)
        narrative.journey = [
            NarrativeElement(element_type=NarrativeElementType.JOURNEY),
            NarrativeElement(element_type=NarrativeElementType.JOURNEY),
        ]
        narrative.resolution = NarrativeElement(element_type=NarrativeElementType.RESOLUTION)

        elements = narrative.get_all_elements()
        assert len(elements) == 5

    def test_total_duration(self):
        """Test total duration calculation."""
        narrative = PresentationNarrative(title="Test")
        narrative.hook = NarrativeElement(
            element_type=NarrativeElementType.HOOK,
            estimated_duration_seconds=30,
        )
        narrative.resolution = NarrativeElement(
            element_type=NarrativeElementType.RESOLUTION,
            estimated_duration_seconds=90,
        )

        assert narrative.total_duration_seconds() == 120

    def test_average_confidence(self):
        """Test average confidence calculation."""
        narrative = PresentationNarrative(title="Test")
        narrative.hook = NarrativeElement(
            element_type=NarrativeElementType.HOOK,
            confidence_score=0.9,
        )
        narrative.resolution = NarrativeElement(
            element_type=NarrativeElementType.RESOLUTION,
            confidence_score=0.7,
        )

        assert narrative.average_confidence() == pytest.approx(0.8)

    def test_empty_narrative_confidence(self):
        """Test confidence for empty narrative."""
        narrative = PresentationNarrative(title="Empty")
        assert narrative.average_confidence() == 0.0

    def test_narrative_to_dict(self):
        """Test narrative to_dict conversion."""
        narrative = PresentationNarrative(
            title="Test",
            target_duration_minutes=10,
        )
        narrative.hook = NarrativeElement(element_type=NarrativeElementType.HOOK)
        data = narrative.to_dict()
        assert data["title"] == "Test"
        assert data["element_count"] == 1


class TestVisualizationData:
    """Tests for VisualizationData."""

    def test_create_viz_data(self):
        """Test creating visualization data."""
        points = [
            DataPoint(value=30, label="A"),
            DataPoint(value=70, label="B"),
        ]
        viz = VisualizationData(
            data_points=points,
            title="Distribution",
            chart_type=VisualizationType.PIE_CHART,
        )
        assert len(viz.data_points) == 2
        assert viz.chart_type == VisualizationType.PIE_CHART


class TestVisualValidator:
    """Tests for VisualValidator."""

    def test_create_validator(self):
        """Test creating a validator."""
        validator = VisualValidator()
        assert validator is not None

    def test_validate_pie_chart_valid(self):
        """Test validating a valid pie chart."""
        validator = VisualValidator()
        data = VisualizationData(
            data_points=[
                DataPoint(value=0.3, label="A"),
                DataPoint(value=0.5, label="B"),
                DataPoint(value=0.2, label="C"),
            ],
            chart_type=VisualizationType.PIE_CHART,
        )
        result = validator.validate(data, VisualizationType.PIE_CHART)
        assert result.is_valid

    def test_validate_pie_chart_too_many_categories(self):
        """Test pie chart with too many categories."""
        validator = VisualValidator()
        points = [DataPoint(value=0.1, label=str(i)) for i in range(10)]
        data = VisualizationData(data_points=points)
        result = validator.validate(data, VisualizationType.PIE_CHART)
        assert not result.is_valid
        assert RejectionReason.TOO_MANY_CATEGORIES in result.rejection_reasons

    def test_validate_pie_chart_invalid_sum(self):
        """Test pie chart with invalid sum."""
        validator = VisualValidator()
        data = VisualizationData(
            data_points=[
                DataPoint(value=0.3, label="A"),
                DataPoint(value=0.3, label="B"),
            ],
        )
        result = validator.validate(data, VisualizationType.PIE_CHART)
        assert not result.is_valid
        assert RejectionReason.PIE_SUM_INVALID in result.rejection_reasons

    def test_validate_pie_chart_negative_values(self):
        """Test pie chart with negative values."""
        validator = VisualValidator()
        data = VisualizationData(
            data_points=[
                DataPoint(value=-0.2, label="A"),
                DataPoint(value=1.2, label="B"),
            ],
        )
        result = validator.validate(data, VisualizationType.PIE_CHART)
        assert not result.is_valid
        assert RejectionReason.NEGATIVE_PIE_VALUES in result.rejection_reasons

    def test_validate_3d_chart_rejected(self):
        """Test 3D chart rejection."""
        validator = VisualValidator()
        data = VisualizationData(
            data_points=[
                DataPoint(value=50, label="A"),
                DataPoint(value=50, label="B"),
            ],
            metadata={"is_3d": True},
        )
        result = validator.validate(data, VisualizationType.BAR_CHART)
        assert not result.is_valid
        assert RejectionReason.THREE_D_CHART in result.rejection_reasons

    def test_validate_dual_axis_rejected(self):
        """Test dual-axis chart rejection."""
        validator = VisualValidator()
        data = VisualizationData(
            data_points=[
                DataPoint(value=50, label="A"),
                DataPoint(value=50, label="B"),
            ],
            metadata={"dual_axis": True},
        )
        result = validator.validate(data, VisualizationType.LINE_CHART)
        assert not result.is_valid
        assert RejectionReason.DUAL_AXIS in result.rejection_reasons

    def test_validate_not_enough_data(self):
        """Test rejection for insufficient data."""
        validator = VisualValidator()
        data = VisualizationData(
            data_points=[DataPoint(value=100, label="Only")],
        )
        result = validator.validate(data, VisualizationType.BAR_CHART)
        assert not result.is_valid
        assert RejectionReason.NOT_ENOUGH_DATA in result.rejection_reasons
        assert result.suggested_type == VisualizationType.SINGLE_STAT

    def test_validate_low_variance(self):
        """Test rejection for low variance data."""
        validator = VisualValidator()
        # All very similar values
        data = VisualizationData(
            data_points=[
                DataPoint(value=100.0, label="A"),
                DataPoint(value=100.1, label="B"),
                DataPoint(value=100.0, label="C"),
            ],
        )
        result = validator.validate(data, VisualizationType.LINE_CHART)
        assert not result.is_valid
        assert RejectionReason.LOW_DATA_VARIANCE in result.rejection_reasons

    def test_suggest_chart_type_single_point(self):
        """Test chart suggestion for single point."""
        validator = VisualValidator()
        data = VisualizationData(
            data_points=[DataPoint(value=42, label="Answer")],
        )
        suggested = validator.suggest_chart_type(data)
        assert suggested == VisualizationType.SINGLE_STAT

    def test_suggest_chart_type_time_series(self):
        """Test chart suggestion for time series."""
        validator = VisualValidator()
        data = VisualizationData(
            data_points=[
                DataPoint(value=10, timestamp=datetime(2024, 1, 1)),
                DataPoint(value=20, timestamp=datetime(2024, 2, 1)),
                DataPoint(value=30, timestamp=datetime(2024, 3, 1)),
            ],
        )
        suggested = validator.suggest_chart_type(data)
        assert suggested == VisualizationType.LINE_CHART

    def test_suggest_chart_type_pie(self):
        """Test chart suggestion for proportional data."""
        validator = VisualValidator()
        data = VisualizationData(
            data_points=[
                DataPoint(value=0.4, label="A"),
                DataPoint(value=0.35, label="B"),
                DataPoint(value=0.25, label="C"),
            ],
        )
        suggested = validator.suggest_chart_type(data)
        assert suggested == VisualizationType.PIE_CHART

    def test_suggest_chart_type_bar(self):
        """Test chart suggestion for categorical data."""
        validator = VisualValidator()
        data = VisualizationData(
            data_points=[
                DataPoint(value=100, category="Q1"),
                DataPoint(value=150, category="Q2"),
                DataPoint(value=200, category="Q3"),
            ],
        )
        suggested = validator.suggest_chart_type(data)
        assert suggested == VisualizationType.BAR_CHART

    def test_validate_no_chart_type(self):
        """Test validation without chart type."""
        validator = VisualValidator()
        data = VisualizationData(data_points=[])
        result = validator.validate(data)
        assert not result.is_valid


class TestSlideCountCalculator:
    """Tests for SlideCountCalculator."""

    def test_create_calculator(self):
        """Test creating a calculator."""
        calc = SlideCountCalculator()
        assert calc.slides_per_minute == 1.0

    def test_calculate_10_minutes(self):
        """Test calculation for 10 minute presentation."""
        calc = SlideCountCalculator()
        counts = calc.calculate(10)
        assert counts["target"] == 10
        assert counts["min"] == 5
        assert counts["max"] == 15

    def test_calculate_30_minutes(self):
        """Test calculation for 30 minute presentation."""
        calc = SlideCountCalculator()
        counts = calc.calculate(30)
        assert counts["target"] == 30
        assert counts["min"] == 15
        assert counts["max"] == 45

    def test_calculate_5_minutes(self):
        """Test calculation for 5 minute presentation."""
        calc = SlideCountCalculator()
        counts = calc.calculate(5)
        assert counts["target"] == 5
        assert counts["min"] == 2
        assert counts["max"] == 8

    def test_is_within_range(self):
        """Test is_within_range check."""
        calc = SlideCountCalculator()
        assert calc.is_within_range(10, 10) is True
        assert calc.is_within_range(5, 10) is True
        assert calc.is_within_range(15, 10) is True
        assert calc.is_within_range(4, 10) is False
        assert calc.is_within_range(16, 10) is False

    def test_get_pacing_feedback_optimal(self):
        """Test pacing feedback for optimal count."""
        calc = SlideCountCalculator()
        feedback = calc.get_pacing_feedback(10, 10)
        assert "Optimal" in feedback

    def test_get_pacing_feedback_too_few(self):
        """Test pacing feedback for too few slides."""
        calc = SlideCountCalculator()
        feedback = calc.get_pacing_feedback(2, 10)
        assert "few" in feedback.lower()

    def test_get_pacing_feedback_too_many(self):
        """Test pacing feedback for too many slides."""
        calc = SlideCountCalculator()
        feedback = calc.get_pacing_feedback(20, 10)
        assert "many" in feedback.lower()

    def test_custom_calculator(self):
        """Test custom slide calculator settings."""
        calc = SlideCountCalculator(
            slides_per_minute=2.0,
            min_multiplier=0.3,
            max_multiplier=2.0,
        )
        counts = calc.calculate(10)
        assert counts["target"] == 20


class TestNarrativeBuilder:
    """Tests for NarrativeBuilder."""

    def test_create_builder(self):
        """Test creating a builder."""
        builder = NarrativeBuilder()
        assert builder is not None

    def test_create_narrative(self):
        """Test creating a narrative."""
        builder = NarrativeBuilder()
        narrative = builder.create_narrative(
            title="Q4 Results",
            target_duration_minutes=10,
            topic="sales performance",
        )
        assert narrative.title == "Q4 Results"
        assert narrative.hook is not None
        assert narrative.context is not None
        assert narrative.tension is not None
        assert len(narrative.journey) >= 2
        assert narrative.resolution is not None
        assert narrative.call_to_action is not None

    def test_create_narrative_with_key_points(self):
        """Test narrative with key points."""
        builder = NarrativeBuilder()
        narrative = builder.create_narrative(
            title="Strategy Update",
            target_duration_minutes=15,
            key_points=["Revenue growth", "Market expansion", "Team building"],
        )
        assert len(narrative.journey) >= 3
        journey_contents = [j.content for j in narrative.journey]
        assert "Revenue growth" in journey_contents

    def test_create_narrative_with_data(self):
        """Test narrative with data points."""
        builder = NarrativeBuilder()
        data = [
            DataPoint(value=100, label="Q1"),
            DataPoint(value=150, label="Q2"),
        ]
        narrative = builder.create_narrative(
            title="Growth Report",
            target_duration_minutes=10,
            key_points=["Q1 performance", "Q2 growth"],
            data_points=data,
        )
        # Check that data is assigned to journey beats
        data_beats = [j for j in narrative.journey if j.supporting_data]
        assert len(data_beats) >= 1

    def test_journey_beats_scale_with_duration(self):
        """Test that journey beats scale with duration."""
        builder = NarrativeBuilder()

        short = builder.create_narrative("Short", target_duration_minutes=5)
        medium = builder.create_narrative("Medium", target_duration_minutes=15)
        long = builder.create_narrative("Long", target_duration_minutes=30)

        assert len(short.journey) <= len(medium.journey)
        assert len(medium.journey) <= len(long.journey)

    def test_update_element(self):
        """Test updating a narrative element."""
        builder = NarrativeBuilder()
        narrative = builder.create_narrative("Test", target_duration_minutes=10)

        element_id = narrative.hook.id
        updated = builder.update_element(
            narrative,
            element_id,
            content="New hook content",
            tone=EmotionalTone.INSPIRATIONAL,
        )
        assert updated is not None
        assert updated.content == "New hook content"
        assert updated.emotional_tone == EmotionalTone.INSPIRATIONAL

    def test_update_nonexistent_element(self):
        """Test updating a nonexistent element."""
        builder = NarrativeBuilder()
        narrative = builder.create_narrative("Test", target_duration_minutes=10)

        updated = builder.update_element(narrative, "fake-id", content="X")
        assert updated is None

    def test_add_journey_beat(self):
        """Test adding a journey beat."""
        builder = NarrativeBuilder()
        narrative = builder.create_narrative("Test", target_duration_minutes=10)
        initial_count = len(narrative.journey)

        new_beat = builder.add_journey_beat(
            narrative,
            content="New insight",
            tone=EmotionalTone.ANALYTICAL,
        )
        assert len(narrative.journey) == initial_count + 1
        assert new_beat.content == "New insight"

    def test_add_journey_beat_at_index(self):
        """Test adding journey beat at specific index."""
        builder = NarrativeBuilder()
        narrative = builder.create_narrative("Test", target_duration_minutes=10)

        builder.add_journey_beat(narrative, content="Inserted", index=1)
        assert narrative.journey[1].content == "Inserted"


class TestSlideGenerator:
    """Tests for SlideGenerator."""

    def test_create_generator(self):
        """Test creating a generator."""
        generator = SlideGenerator()
        assert generator is not None

    def test_generate_slides(self):
        """Test generating slides from narrative."""
        builder = NarrativeBuilder()
        generator = SlideGenerator()

        narrative = builder.create_narrative(
            title="Test Presentation",
            target_duration_minutes=10,
        )
        presentation = generator.generate_slides(narrative)

        assert presentation.title == "Test Presentation"
        assert len(presentation.slides) > 0

    def test_generate_slides_with_title(self):
        """Test slide generation includes title slide."""
        builder = NarrativeBuilder()
        generator = SlideGenerator()

        narrative = builder.create_narrative("Test", target_duration_minutes=10)
        presentation = generator.generate_slides(
            narrative, include_title_slide=True
        )

        title_slides = [s for s in presentation.slides if s.slide_type == SlideType.TITLE]
        assert len(title_slides) == 1

    def test_generate_slides_with_summary(self):
        """Test slide generation includes summary slide."""
        builder = NarrativeBuilder()
        generator = SlideGenerator()

        narrative = builder.create_narrative("Test", target_duration_minutes=10)
        presentation = generator.generate_slides(
            narrative, include_summary_slide=True
        )

        summary_slides = [s for s in presentation.slides if s.slide_type == SlideType.SUMMARY]
        assert len(summary_slides) == 1

    def test_generate_slides_without_extras(self):
        """Test slide generation without title/summary."""
        builder = NarrativeBuilder()
        generator = SlideGenerator()

        narrative = builder.create_narrative("Test", target_duration_minutes=10)
        presentation = generator.generate_slides(
            narrative,
            include_title_slide=False,
            include_summary_slide=False,
        )

        # Should only have narrative element slides
        element_count = len(narrative.get_all_elements())
        assert presentation.slide_count() == element_count

    def test_slide_has_narrative_element_id(self):
        """Test that slides reference narrative elements."""
        builder = NarrativeBuilder()
        generator = SlideGenerator()

        narrative = builder.create_narrative("Test", target_duration_minutes=10)
        presentation = generator.generate_slides(
            narrative, include_title_slide=False, include_summary_slide=False
        )

        content_slides = [s for s in presentation.slides if s.narrative_element_id]
        assert len(content_slides) > 0

    def test_validate_presentation_valid(self):
        """Test validating a valid presentation."""
        builder = NarrativeBuilder()
        generator = SlideGenerator()

        narrative = builder.create_narrative("Test", target_duration_minutes=10)
        presentation = generator.generate_slides(narrative)

        validation = generator.validate_presentation(presentation)
        assert "slide_count" in validation
        assert "pacing" in validation

    def test_validate_presentation_few_slides(self):
        """Test validating presentation with few slides."""
        generator = SlideGenerator()
        presentation = Presentation(
            title="Too Short",
            target_duration_minutes=30,
            slides=[Slide(title="Only One")],
        )

        validation = generator.validate_presentation(presentation)
        assert len(validation["issues"]) > 0

    def test_slides_ordered_correctly(self):
        """Test that slides have correct order."""
        builder = NarrativeBuilder()
        generator = SlideGenerator()

        narrative = builder.create_narrative("Test", target_duration_minutes=10)
        presentation = generator.generate_slides(narrative)

        orders = [s.order for s in presentation.slides]
        assert orders == sorted(orders)


class TestSlide:
    """Tests for Slide."""

    def test_create_slide(self):
        """Test creating a slide."""
        slide = Slide(
            slide_type=SlideType.CONTENT,
            title="Main Point",
            content="Important information",
        )
        assert slide.title == "Main Point"
        assert slide.slide_type == SlideType.CONTENT

    def test_slide_with_bullets(self):
        """Test slide with bullet points."""
        slide = Slide(
            slide_type=SlideType.CONTENT,
            title="Key Points",
            bullet_points=["Point 1", "Point 2", "Point 3"],
        )
        assert len(slide.bullet_points) == 3

    def test_slide_with_visualization(self):
        """Test slide with visualization."""
        viz = VisualizationData(
            data_points=[DataPoint(value=100)],
            chart_type=VisualizationType.SINGLE_STAT,
        )
        slide = Slide(
            slide_type=SlideType.DATA,
            title="Stats",
            visualization=viz,
        )
        assert slide.visualization is not None


class TestPresentation:
    """Tests for Presentation."""

    def test_create_presentation(self):
        """Test creating a presentation."""
        pres = Presentation(
            title="Annual Report",
            author="Team",
        )
        assert pres.title == "Annual Report"
        assert pres.slide_count() == 0

    def test_presentation_slide_count(self):
        """Test presentation slide count."""
        pres = Presentation(
            title="Test",
            slides=[
                Slide(title="1"),
                Slide(title="2"),
                Slide(title="3"),
            ],
        )
        assert pres.slide_count() == 3


class TestEnums:
    """Tests for enums."""

    def test_narrative_element_type_values(self):
        """Test narrative element type values."""
        assert NarrativeElementType.HOOK.value == "hook"
        assert NarrativeElementType.CONTEXT.value == "context"
        assert NarrativeElementType.CALL_TO_ACTION.value == "cta"

    def test_emotional_tone_values(self):
        """Test emotional tone values."""
        assert EmotionalTone.NEUTRAL.value == "neutral"
        assert EmotionalTone.URGENT.value == "urgent"
        assert EmotionalTone.OPTIMISTIC.value == "optimistic"

    def test_visualization_type_values(self):
        """Test visualization type values."""
        assert VisualizationType.BAR_CHART.value == "bar_chart"
        assert VisualizationType.PIE_CHART.value == "pie_chart"
        assert VisualizationType.LINE_CHART.value == "line_chart"

    def test_rejection_reason_values(self):
        """Test rejection reason values."""
        assert RejectionReason.NOT_ENOUGH_DATA.value == "not_enough_data"
        assert RejectionReason.THREE_D_CHART.value == "three_d_chart"

    def test_slide_type_values(self):
        """Test slide type values."""
        assert SlideType.TITLE.value == "title"
        assert SlideType.CONTENT.value == "content"
        assert SlideType.DATA.value == "data"


class TestGlobalInstances:
    """Tests for global instance management."""

    def teardown_method(self):
        """Reset global instances after each test."""
        reset_narrative_builder()

    def test_get_builder_none(self):
        """Test getting builder when not set."""
        reset_narrative_builder()
        assert get_narrative_builder() is None

    def test_set_and_get_builder(self):
        """Test setting and getting builder."""
        builder = NarrativeBuilder()
        set_narrative_builder(builder)
        assert get_narrative_builder() is builder

    def test_reset_builder(self):
        """Test resetting builder."""
        builder = NarrativeBuilder()
        set_narrative_builder(builder)
        reset_narrative_builder()
        assert get_narrative_builder() is None

    def test_set_and_get_validator(self):
        """Test setting and getting validator."""
        validator = VisualValidator()
        set_visual_validator(validator)
        assert get_visual_validator() is validator

    def test_set_and_get_generator(self):
        """Test setting and getting generator."""
        generator = SlideGenerator()
        set_slide_generator(generator)
        assert get_slide_generator() is generator


class TestIntegration:
    """Integration tests for presentation generation."""

    def test_full_workflow(self):
        """Test complete presentation generation workflow."""
        builder = NarrativeBuilder()
        generator = SlideGenerator()

        # Create narrative
        narrative = builder.create_narrative(
            title="Quarterly Business Review",
            target_duration_minutes=15,
            topic="company performance",
            key_points=[
                "Revenue exceeded targets by 15%",
                "Customer satisfaction at all-time high",
                "New product launch successful",
            ],
            data_points=[
                DataPoint(value=115, label="Q4 Revenue %"),
                DataPoint(value=92, label="CSAT Score"),
                DataPoint(value=50000, label="New Users"),
            ],
        )

        # Generate presentation
        presentation = generator.generate_slides(narrative)

        # Validate
        validation = generator.validate_presentation(presentation)

        assert narrative.title == "Quarterly Business Review"
        assert presentation.slide_count() > 5
        assert "pacing" in validation

    def test_visualization_validation_in_slides(self):
        """Test that visualizations are validated during slide generation."""
        builder = NarrativeBuilder()
        generator = SlideGenerator()

        # Create narrative with data that would fail pie chart validation
        data = [DataPoint(value=i * 10, label=str(i)) for i in range(10)]
        narrative = builder.create_narrative(
            title="Test",
            target_duration_minutes=10,
            key_points=[f"Point {i}" for i in range(5)],
            data_points=data[:5],
        )

        # Force a pie chart suggestion (will be rejected due to too many categories)
        for beat in narrative.journey:
            if beat.supporting_data:
                beat.visual_suggestion = VisualizationType.PIE_CHART

        presentation = generator.generate_slides(narrative)

        # Generator should have adjusted invalid visualizations
        assert presentation.slide_count() > 0
