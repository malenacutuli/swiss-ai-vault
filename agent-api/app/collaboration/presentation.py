"""
Presentation Generation Module

Implements:
- Narrative construction for presentations (hook, context, tension, journey, resolution, CTA)
- Visual selector for appropriate chart types
- Visual validator with rejection rules
- Slide count heuristics based on duration
- Integration with confidence scoring
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple, Union
from math import ceil
import statistics
import uuid


class NarrativeElementType(Enum):
    """Types of narrative elements in a presentation."""
    HOOK = "hook"                # First 30 seconds: Why should audience care?
    CONTEXT = "context"          # Background information
    TENSION = "tension"          # Problem or opportunity statement
    JOURNEY = "journey"          # Exploration beats
    RESOLUTION = "resolution"    # Answer or recommendation
    CALL_TO_ACTION = "cta"       # Next steps


class EmotionalTone(Enum):
    """Emotional tone for narrative elements."""
    NEUTRAL = "neutral"
    URGENT = "urgent"
    OPTIMISTIC = "optimistic"
    CAUTIONARY = "cautionary"
    INSPIRATIONAL = "inspirational"
    ANALYTICAL = "analytical"


class VisualizationType(Enum):
    """Types of data visualizations."""
    BAR_CHART = "bar_chart"
    LINE_CHART = "line_chart"
    PIE_CHART = "pie_chart"
    SCATTER_PLOT = "scatter_plot"
    AREA_CHART = "area_chart"
    HISTOGRAM = "histogram"
    SINGLE_STAT = "single_stat"
    TABLE = "table"
    TREEMAP = "treemap"
    HEATMAP = "heatmap"
    FUNNEL = "funnel"
    GAUGE = "gauge"
    TEXT_ONLY = "text_only"
    IMAGE = "image"


class RejectionReason(Enum):
    """Reasons for rejecting a visualization."""
    NOT_ENOUGH_DATA = "not_enough_data"
    TOO_MANY_CATEGORIES = "too_many_categories"
    PIE_SUM_INVALID = "pie_sum_invalid"
    NON_SEQUENTIAL_DATA = "non_sequential_data"
    THREE_D_CHART = "three_d_chart"
    DUAL_AXIS = "dual_axis"
    LOW_DATA_VARIANCE = "low_data_variance"
    NEGATIVE_PIE_VALUES = "negative_pie_values"
    MISSING_LABELS = "missing_labels"
    DATA_TYPE_MISMATCH = "data_type_mismatch"


class SlideType(Enum):
    """Types of presentation slides."""
    TITLE = "title"
    CONTENT = "content"
    DATA = "data"
    IMAGE = "image"
    QUOTE = "quote"
    COMPARISON = "comparison"
    TIMELINE = "timeline"
    SECTION_BREAK = "section_break"
    SUMMARY = "summary"
    CALL_TO_ACTION = "call_to_action"


@dataclass
class DataPoint:
    """A single data point with metadata."""
    value: Union[int, float, str]
    label: str = ""
    category: str = ""
    timestamp: Optional[datetime] = None
    confidence: float = 1.0
    source: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class VisualizationData:
    """Data for a visualization."""
    data_points: List[DataPoint]
    title: str = ""
    x_label: str = ""
    y_label: str = ""
    chart_type: Optional[VisualizationType] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationResult:
    """Result of visualization validation."""
    is_valid: bool
    rejection_reasons: List[RejectionReason] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    suggested_type: Optional[VisualizationType] = None
    suggestions: List[str] = field(default_factory=list)


@dataclass
class NarrativeElement:
    """A single element in the presentation narrative."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    element_type: NarrativeElementType = NarrativeElementType.JOURNEY
    content: str = ""
    supporting_data: List[DataPoint] = field(default_factory=list)
    visual_suggestion: Optional[VisualizationType] = None
    estimated_duration_seconds: int = 60
    emotional_tone: EmotionalTone = EmotionalTone.NEUTRAL
    confidence_score: float = 1.0
    speaker_notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "element_type": self.element_type.value,
            "content": self.content,
            "data_point_count": len(self.supporting_data),
            "visual_suggestion": self.visual_suggestion.value if self.visual_suggestion else None,
            "estimated_duration_seconds": self.estimated_duration_seconds,
            "emotional_tone": self.emotional_tone.value,
            "confidence_score": self.confidence_score,
        }


@dataclass
class PresentationNarrative:
    """Complete narrative structure for a presentation."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    hook: Optional[NarrativeElement] = None
    context: Optional[NarrativeElement] = None
    tension: Optional[NarrativeElement] = None
    journey: List[NarrativeElement] = field(default_factory=list)
    resolution: Optional[NarrativeElement] = None
    call_to_action: Optional[NarrativeElement] = None
    target_duration_minutes: int = 10
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_all_elements(self) -> List[NarrativeElement]:
        """Get all narrative elements in order."""
        elements = []
        if self.hook:
            elements.append(self.hook)
        if self.context:
            elements.append(self.context)
        if self.tension:
            elements.append(self.tension)
        elements.extend(self.journey)
        if self.resolution:
            elements.append(self.resolution)
        if self.call_to_action:
            elements.append(self.call_to_action)
        return elements

    def total_duration_seconds(self) -> int:
        """Calculate total estimated duration."""
        return sum(e.estimated_duration_seconds for e in self.get_all_elements())

    def average_confidence(self) -> float:
        """Calculate average confidence across elements."""
        elements = self.get_all_elements()
        if not elements:
            return 0.0
        return sum(e.confidence_score for e in elements) / len(elements)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "element_count": len(self.get_all_elements()),
            "journey_beats": len(self.journey),
            "total_duration_seconds": self.total_duration_seconds(),
            "target_duration_minutes": self.target_duration_minutes,
            "average_confidence": self.average_confidence(),
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class Slide:
    """A presentation slide."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    slide_type: SlideType = SlideType.CONTENT
    title: str = ""
    content: str = ""
    bullet_points: List[str] = field(default_factory=list)
    visualization: Optional[VisualizationData] = None
    speaker_notes: str = ""
    narrative_element_id: Optional[str] = None
    order: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Presentation:
    """A complete presentation."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    subtitle: str = ""
    author: str = ""
    slides: List[Slide] = field(default_factory=list)
    narrative: Optional[PresentationNarrative] = None
    target_duration_minutes: int = 10
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def slide_count(self) -> int:
        """Get number of slides."""
        return len(self.slides)


class VisualValidator:
    """
    Validates data visualizations against rejection rules.

    Ensures charts are appropriate for the data and don't
    mislead the audience.
    """

    # Maximum categories for pie charts
    MAX_PIE_CATEGORIES = 7

    # Minimum data points for most charts
    MIN_DATA_POINTS = 2

    # Coefficient of variation threshold (5%)
    MIN_VARIANCE_THRESHOLD = 0.05

    # Pie chart sum tolerance
    PIE_SUM_TOLERANCE = 0.01

    def __init__(self):
        self._validators: Dict[VisualizationType, Callable] = {
            VisualizationType.PIE_CHART: self._validate_pie_chart,
            VisualizationType.LINE_CHART: self._validate_line_chart,
            VisualizationType.BAR_CHART: self._validate_bar_chart,
            VisualizationType.SCATTER_PLOT: self._validate_scatter_plot,
        }

    def validate(
        self,
        data: VisualizationData,
        chart_type: Optional[VisualizationType] = None
    ) -> ValidationResult:
        """
        Validate data for a specific chart type.

        Args:
            data: The visualization data
            chart_type: Requested chart type (uses data.chart_type if not specified)

        Returns:
            ValidationResult with validity and any issues
        """
        chart_type = chart_type or data.chart_type
        if not chart_type:
            return ValidationResult(
                is_valid=False,
                rejection_reasons=[RejectionReason.DATA_TYPE_MISMATCH],
                suggestions=["Specify a chart type"],
            )

        result = ValidationResult(is_valid=True)

        # Check for 3D charts (always reject)
        if self._is_3d_chart(chart_type, data):
            result.is_valid = False
            result.rejection_reasons.append(RejectionReason.THREE_D_CHART)
            result.suggestions.append("Use 2D charts for accurate data perception")

        # Check for dual-axis (almost always reject)
        if self._is_dual_axis(data):
            result.is_valid = False
            result.rejection_reasons.append(RejectionReason.DUAL_AXIS)
            result.suggestions.append("Use separate charts for different scales")

        # Check minimum data points
        if len(data.data_points) < self.MIN_DATA_POINTS:
            if chart_type != VisualizationType.SINGLE_STAT:
                result.is_valid = False
                result.rejection_reasons.append(RejectionReason.NOT_ENOUGH_DATA)
                result.suggested_type = VisualizationType.SINGLE_STAT
                result.suggestions.append("Use a single stat display instead")

        # Check for missing labels
        if not self._has_valid_labels(data):
            result.warnings.append("Some data points are missing labels")

        # Run type-specific validation
        if chart_type in self._validators:
            type_result = self._validators[chart_type](data)
            result.is_valid = result.is_valid and type_result.is_valid
            result.rejection_reasons.extend(type_result.rejection_reasons)
            result.warnings.extend(type_result.warnings)
            result.suggestions.extend(type_result.suggestions)
            if type_result.suggested_type and not result.suggested_type:
                result.suggested_type = type_result.suggested_type

        return result

    def suggest_chart_type(self, data: VisualizationData) -> VisualizationType:
        """
        Suggest the best chart type for the data.

        Args:
            data: The visualization data

        Returns:
            Recommended VisualizationType
        """
        points = data.data_points
        count = len(points)

        # Single data point
        if count < 2:
            return VisualizationType.SINGLE_STAT

        # Check if data has timestamps (time series)
        has_timestamps = all(p.timestamp for p in points)
        if has_timestamps:
            return VisualizationType.LINE_CHART

        # Check if data represents parts of a whole
        values = [p.value for p in points if isinstance(p.value, (int, float))]
        if values and 0.99 <= sum(values) <= 1.01:
            if count <= self.MAX_PIE_CATEGORIES:
                return VisualizationType.PIE_CHART
            return VisualizationType.BAR_CHART

        # Check variance for bar chart suitability
        if values and len(values) >= 2:
            try:
                cv = statistics.stdev(values) / statistics.mean(values)
                if cv < self.MIN_VARIANCE_THRESHOLD:
                    return VisualizationType.TABLE
            except (statistics.StatisticsError, ZeroDivisionError):
                pass

        # Default to bar chart for categorical data
        if all(p.category or p.label for p in points):
            return VisualizationType.BAR_CHART

        # Numeric pairs suggest scatter plot
        return VisualizationType.BAR_CHART

    def _validate_pie_chart(self, data: VisualizationData) -> ValidationResult:
        """Validate pie chart specific rules."""
        result = ValidationResult(is_valid=True)
        points = data.data_points

        # Check category count
        if len(points) > self.MAX_PIE_CATEGORIES:
            result.is_valid = False
            result.rejection_reasons.append(RejectionReason.TOO_MANY_CATEGORIES)
            result.suggested_type = VisualizationType.BAR_CHART
            result.suggestions.append(
                f"Group categories into 'Other' or use bar chart (max {self.MAX_PIE_CATEGORIES} categories)"
            )

        # Check for negative values
        values = [p.value for p in points if isinstance(p.value, (int, float))]
        if any(v < 0 for v in values):
            result.is_valid = False
            result.rejection_reasons.append(RejectionReason.NEGATIVE_PIE_VALUES)
            result.suggestions.append("Pie charts cannot display negative values")

        # Check sum equals 100% or 1.0
        if values:
            total = sum(values)
            if not (0.99 <= total <= 1.01 or 99 <= total <= 101):
                result.is_valid = False
                result.rejection_reasons.append(RejectionReason.PIE_SUM_INVALID)
                result.suggestions.append(
                    f"Pie chart values must sum to 100% or 1.0 (current sum: {total})"
                )

        return result

    def _validate_line_chart(self, data: VisualizationData) -> ValidationResult:
        """Validate line chart specific rules."""
        result = ValidationResult(is_valid=True)
        points = data.data_points

        # Check for sequential x-axis
        if not self._is_sequential(points):
            result.warnings.append("Line charts work best with sequential data")

        # Check variance
        values = [p.value for p in points if isinstance(p.value, (int, float))]
        if values and len(values) >= 2:
            try:
                mean = statistics.mean(values)
                if mean != 0:
                    cv = statistics.stdev(values) / mean
                    if cv < self.MIN_VARIANCE_THRESHOLD:
                        result.is_valid = False
                        result.rejection_reasons.append(RejectionReason.LOW_DATA_VARIANCE)
                        result.suggested_type = VisualizationType.TABLE
                        result.suggestions.append("Data variance too low for meaningful visualization")
            except statistics.StatisticsError:
                pass

        return result

    def _validate_bar_chart(self, data: VisualizationData) -> ValidationResult:
        """Validate bar chart specific rules."""
        result = ValidationResult(is_valid=True)

        # Bar charts are generally flexible
        if len(data.data_points) > 20:
            result.warnings.append("Consider grouping categories for readability")

        return result

    def _validate_scatter_plot(self, data: VisualizationData) -> ValidationResult:
        """Validate scatter plot specific rules."""
        result = ValidationResult(is_valid=True)

        if len(data.data_points) < 5:
            result.warnings.append("Scatter plots work best with more data points")

        return result

    def _is_3d_chart(
        self, chart_type: VisualizationType, data: VisualizationData
    ) -> bool:
        """Check if chart is 3D (always rejected)."""
        return data.metadata.get("is_3d", False)

    def _is_dual_axis(self, data: VisualizationData) -> bool:
        """Check if chart uses dual axes (almost always rejected)."""
        return data.metadata.get("dual_axis", False)

    def _has_valid_labels(self, data: VisualizationData) -> bool:
        """Check if data points have valid labels."""
        return all(p.label or p.category for p in data.data_points)

    def _is_sequential(self, points: List[DataPoint]) -> bool:
        """Check if data points are sequential."""
        if not points:
            return True

        # Check timestamps
        timestamps = [p.timestamp for p in points if p.timestamp]
        if len(timestamps) == len(points):
            sorted_ts = sorted(timestamps)
            return timestamps == sorted_ts

        # Check numeric sequence
        try:
            values = [float(p.label) for p in points if p.label]
            if len(values) == len(points):
                sorted_vals = sorted(values)
                return values == sorted_vals
        except (ValueError, TypeError):
            pass

        return True  # Assume sequential if can't determine


class SlideCountCalculator:
    """
    Calculates optimal slide counts based on presentation duration.

    Uses heuristics to determine target, minimum, and maximum slides.
    """

    def __init__(
        self,
        slides_per_minute: float = 1.0,
        min_multiplier: float = 0.5,
        max_multiplier: float = 1.5
    ):
        self.slides_per_minute = slides_per_minute
        self.min_multiplier = min_multiplier
        self.max_multiplier = max_multiplier

    def calculate(self, duration_minutes: int) -> Dict[str, int]:
        """
        Calculate slide count targets.

        Args:
            duration_minutes: Target presentation duration

        Returns:
            Dict with 'target', 'min', and 'max' slide counts
        """
        target = int(duration_minutes * self.slides_per_minute)
        min_slides = max(1, int(duration_minutes * self.min_multiplier))
        max_slides = ceil(duration_minutes * self.max_multiplier)

        return {
            "target": target,
            "min": min_slides,
            "max": max_slides,
        }

    def is_within_range(self, slide_count: int, duration_minutes: int) -> bool:
        """Check if slide count is within acceptable range."""
        counts = self.calculate(duration_minutes)
        return counts["min"] <= slide_count <= counts["max"]

    def get_pacing_feedback(
        self, slide_count: int, duration_minutes: int
    ) -> str:
        """Get feedback on presentation pacing."""
        counts = self.calculate(duration_minutes)

        if slide_count < counts["min"]:
            return "Too few slides - consider adding more content or reducing duration"
        elif slide_count > counts["max"]:
            return "Too many slides - consider condensing content or increasing duration"
        elif slide_count < counts["target"]:
            return "Slightly under target - good for detailed explanations"
        elif slide_count > counts["target"]:
            return "Slightly over target - ensure transitions are smooth"
        else:
            return "Optimal slide count for duration"


class NarrativeBuilder:
    """
    Builds presentation narratives from content.

    Creates structured narratives with hooks, context, tension,
    journey beats, resolution, and call-to-action.
    """

    # Recommended journey beats for different durations
    JOURNEY_BEATS = {
        5: 2,    # 5 min: 2 beats
        10: 3,   # 10 min: 3 beats
        15: 4,   # 15 min: 4 beats
        30: 5,   # 30 min: 5 beats
        60: 7,   # 60 min: 7 beats
    }

    # Duration allocations (percentages)
    DURATION_ALLOCATION = {
        NarrativeElementType.HOOK: 0.05,        # 5%
        NarrativeElementType.CONTEXT: 0.15,     # 15%
        NarrativeElementType.TENSION: 0.10,     # 10%
        NarrativeElementType.JOURNEY: 0.50,     # 50%
        NarrativeElementType.RESOLUTION: 0.15,  # 15%
        NarrativeElementType.CALL_TO_ACTION: 0.05,  # 5%
    }

    def __init__(self, validator: Optional[VisualValidator] = None):
        self.validator = validator or VisualValidator()

    def create_narrative(
        self,
        title: str,
        target_duration_minutes: int = 10,
        topic: str = "",
        key_points: Optional[List[str]] = None,
        data_points: Optional[List[DataPoint]] = None,
    ) -> PresentationNarrative:
        """
        Create a presentation narrative structure.

        Args:
            title: Presentation title
            target_duration_minutes: Target duration
            topic: Main topic
            key_points: Key points to cover
            data_points: Supporting data

        Returns:
            PresentationNarrative structure
        """
        key_points = key_points or []
        data_points = data_points or []
        total_seconds = target_duration_minutes * 60

        narrative = PresentationNarrative(
            title=title,
            target_duration_minutes=target_duration_minutes,
        )

        # Create hook
        narrative.hook = self._create_element(
            NarrativeElementType.HOOK,
            content=f"Why {topic} matters now" if topic else "Opening hook",
            duration_seconds=int(total_seconds * self.DURATION_ALLOCATION[NarrativeElementType.HOOK]),
            tone=EmotionalTone.URGENT,
        )

        # Create context
        narrative.context = self._create_element(
            NarrativeElementType.CONTEXT,
            content=f"Background on {topic}" if topic else "Context and background",
            duration_seconds=int(total_seconds * self.DURATION_ALLOCATION[NarrativeElementType.CONTEXT]),
            tone=EmotionalTone.ANALYTICAL,
        )

        # Create tension
        narrative.tension = self._create_element(
            NarrativeElementType.TENSION,
            content="The challenge we face",
            duration_seconds=int(total_seconds * self.DURATION_ALLOCATION[NarrativeElementType.TENSION]),
            tone=EmotionalTone.CAUTIONARY,
        )

        # Create journey beats
        num_beats = self._get_journey_beats(target_duration_minutes)
        journey_duration = int(total_seconds * self.DURATION_ALLOCATION[NarrativeElementType.JOURNEY])
        beat_duration = journey_duration // num_beats

        for i, point in enumerate(key_points[:num_beats]):
            beat = self._create_element(
                NarrativeElementType.JOURNEY,
                content=point,
                duration_seconds=beat_duration,
                tone=EmotionalTone.NEUTRAL,
            )
            # Assign data points to journey beats
            if data_points and i < len(data_points):
                beat.supporting_data = [data_points[i]]
                beat.visual_suggestion = self.validator.suggest_chart_type(
                    VisualizationData(data_points=[data_points[i]])
                )
            narrative.journey.append(beat)

        # Fill remaining journey beats if needed
        while len(narrative.journey) < num_beats:
            narrative.journey.append(self._create_element(
                NarrativeElementType.JOURNEY,
                content=f"Key insight {len(narrative.journey) + 1}",
                duration_seconds=beat_duration,
            ))

        # Create resolution
        narrative.resolution = self._create_element(
            NarrativeElementType.RESOLUTION,
            content="Our recommendation",
            duration_seconds=int(total_seconds * self.DURATION_ALLOCATION[NarrativeElementType.RESOLUTION]),
            tone=EmotionalTone.OPTIMISTIC,
        )

        # Create call-to-action
        narrative.call_to_action = self._create_element(
            NarrativeElementType.CALL_TO_ACTION,
            content="Next steps",
            duration_seconds=int(total_seconds * self.DURATION_ALLOCATION[NarrativeElementType.CALL_TO_ACTION]),
            tone=EmotionalTone.INSPIRATIONAL,
        )

        return narrative

    def _create_element(
        self,
        element_type: NarrativeElementType,
        content: str,
        duration_seconds: int,
        tone: EmotionalTone = EmotionalTone.NEUTRAL,
        data: Optional[List[DataPoint]] = None,
    ) -> NarrativeElement:
        """Create a narrative element."""
        return NarrativeElement(
            element_type=element_type,
            content=content,
            estimated_duration_seconds=duration_seconds,
            emotional_tone=tone,
            supporting_data=data or [],
        )

    def _get_journey_beats(self, duration_minutes: int) -> int:
        """Get recommended journey beats for duration."""
        # Find closest duration
        durations = sorted(self.JOURNEY_BEATS.keys())
        for d in durations:
            if duration_minutes <= d:
                return self.JOURNEY_BEATS[d]
        return self.JOURNEY_BEATS[durations[-1]]

    def update_element(
        self,
        narrative: PresentationNarrative,
        element_id: str,
        content: Optional[str] = None,
        tone: Optional[EmotionalTone] = None,
        duration: Optional[int] = None,
        data: Optional[List[DataPoint]] = None,
    ) -> Optional[NarrativeElement]:
        """Update a narrative element by ID."""
        for element in narrative.get_all_elements():
            if element.id == element_id:
                if content is not None:
                    element.content = content
                if tone is not None:
                    element.emotional_tone = tone
                if duration is not None:
                    element.estimated_duration_seconds = duration
                if data is not None:
                    element.supporting_data = data
                return element
        return None

    def add_journey_beat(
        self,
        narrative: PresentationNarrative,
        content: str,
        index: Optional[int] = None,
        tone: EmotionalTone = EmotionalTone.NEUTRAL,
        data: Optional[List[DataPoint]] = None,
    ) -> NarrativeElement:
        """Add a journey beat to the narrative."""
        # Calculate duration based on existing journey
        if narrative.journey:
            avg_duration = sum(
                j.estimated_duration_seconds for j in narrative.journey
            ) // len(narrative.journey)
        else:
            total = narrative.target_duration_minutes * 60
            avg_duration = int(total * self.DURATION_ALLOCATION[NarrativeElementType.JOURNEY] / 3)

        element = self._create_element(
            NarrativeElementType.JOURNEY,
            content=content,
            duration_seconds=avg_duration,
            tone=tone,
            data=data,
        )

        if index is not None and 0 <= index <= len(narrative.journey):
            narrative.journey.insert(index, element)
        else:
            narrative.journey.append(element)

        return element


class SlideGenerator:
    """
    Generates presentation slides from narratives.

    Converts narrative elements into slides with appropriate
    visualizations and content.
    """

    def __init__(
        self,
        validator: Optional[VisualValidator] = None,
        slide_calculator: Optional[SlideCountCalculator] = None,
    ):
        self.validator = validator or VisualValidator()
        self.slide_calculator = slide_calculator or SlideCountCalculator()

    def generate_slides(
        self,
        narrative: PresentationNarrative,
        include_title_slide: bool = True,
        include_summary_slide: bool = True,
    ) -> Presentation:
        """
        Generate slides from a narrative.

        Args:
            narrative: The presentation narrative
            include_title_slide: Whether to add title slide
            include_summary_slide: Whether to add summary slide

        Returns:
            Presentation with generated slides
        """
        presentation = Presentation(
            title=narrative.title,
            narrative=narrative,
            target_duration_minutes=narrative.target_duration_minutes,
        )

        order = 0

        # Title slide
        if include_title_slide:
            presentation.slides.append(Slide(
                slide_type=SlideType.TITLE,
                title=narrative.title,
                order=order,
            ))
            order += 1

        # Generate slides from narrative elements
        for element in narrative.get_all_elements():
            slide = self._element_to_slide(element, order)
            presentation.slides.append(slide)
            order += 1

        # Summary slide
        if include_summary_slide:
            presentation.slides.append(Slide(
                slide_type=SlideType.SUMMARY,
                title="Summary",
                bullet_points=[
                    e.content for e in narrative.get_all_elements()
                    if e.element_type in [
                        NarrativeElementType.TENSION,
                        NarrativeElementType.RESOLUTION,
                    ]
                ],
                order=order,
            ))

        return presentation

    def _element_to_slide(
        self, element: NarrativeElement, order: int
    ) -> Slide:
        """Convert a narrative element to a slide."""
        slide_type = self._get_slide_type(element)

        slide = Slide(
            slide_type=slide_type,
            title=self._get_slide_title(element),
            content=element.content,
            speaker_notes=element.speaker_notes or element.content,
            narrative_element_id=element.id,
            order=order,
        )

        # Add visualization if data exists
        if element.supporting_data:
            viz_data = VisualizationData(
                data_points=element.supporting_data,
                chart_type=element.visual_suggestion,
            )
            # Validate and adjust if needed
            if element.visual_suggestion:
                validation = self.validator.validate(viz_data, element.visual_suggestion)
                if not validation.is_valid and validation.suggested_type:
                    viz_data.chart_type = validation.suggested_type
            else:
                viz_data.chart_type = self.validator.suggest_chart_type(viz_data)

            slide.visualization = viz_data

        return slide

    def _get_slide_type(self, element: NarrativeElement) -> SlideType:
        """Determine slide type from element type."""
        mapping = {
            NarrativeElementType.HOOK: SlideType.CONTENT,
            NarrativeElementType.CONTEXT: SlideType.CONTENT,
            NarrativeElementType.TENSION: SlideType.CONTENT,
            NarrativeElementType.JOURNEY: SlideType.DATA if element.supporting_data else SlideType.CONTENT,
            NarrativeElementType.RESOLUTION: SlideType.CONTENT,
            NarrativeElementType.CALL_TO_ACTION: SlideType.CALL_TO_ACTION,
        }
        return mapping.get(element.element_type, SlideType.CONTENT)

    def _get_slide_title(self, element: NarrativeElement) -> str:
        """Generate slide title from element."""
        titles = {
            NarrativeElementType.HOOK: "Why This Matters",
            NarrativeElementType.CONTEXT: "Background",
            NarrativeElementType.TENSION: "The Challenge",
            NarrativeElementType.JOURNEY: "Key Insight",
            NarrativeElementType.RESOLUTION: "Our Recommendation",
            NarrativeElementType.CALL_TO_ACTION: "Next Steps",
        }
        return titles.get(element.element_type, "")

    def validate_presentation(
        self, presentation: Presentation
    ) -> Dict[str, Any]:
        """Validate a presentation."""
        issues = []
        warnings = []

        # Check slide count
        counts = self.slide_calculator.calculate(presentation.target_duration_minutes)
        if presentation.slide_count() < counts["min"]:
            issues.append(f"Too few slides ({presentation.slide_count()} < {counts['min']})")
        elif presentation.slide_count() > counts["max"]:
            warnings.append(f"Many slides ({presentation.slide_count()} > {counts['max']})")

        # Validate visualizations
        for slide in presentation.slides:
            if slide.visualization:
                result = self.validator.validate(
                    slide.visualization,
                    slide.visualization.chart_type
                )
                if not result.is_valid:
                    issues.append(f"Slide {slide.order}: {', '.join(r.value for r in result.rejection_reasons)}")
                warnings.extend(result.warnings)

        return {
            "is_valid": len(issues) == 0,
            "issues": issues,
            "warnings": warnings,
            "slide_count": presentation.slide_count(),
            "target_slides": counts["target"],
            "pacing": self.slide_calculator.get_pacing_feedback(
                presentation.slide_count(),
                presentation.target_duration_minutes,
            ),
        }


# Global instance management
_narrative_builder: Optional[NarrativeBuilder] = None
_visual_validator: Optional[VisualValidator] = None
_slide_generator: Optional[SlideGenerator] = None


def get_narrative_builder() -> Optional[NarrativeBuilder]:
    """Get the global narrative builder."""
    return _narrative_builder


def set_narrative_builder(builder: NarrativeBuilder) -> None:
    """Set the global narrative builder."""
    global _narrative_builder
    _narrative_builder = builder


def reset_narrative_builder() -> None:
    """Reset the global narrative builder."""
    global _narrative_builder
    _narrative_builder = None


def get_visual_validator() -> Optional[VisualValidator]:
    """Get the global visual validator."""
    return _visual_validator


def set_visual_validator(validator: VisualValidator) -> None:
    """Set the global visual validator."""
    global _visual_validator
    _visual_validator = validator


def get_slide_generator() -> Optional[SlideGenerator]:
    """Get the global slide generator."""
    return _slide_generator


def set_slide_generator(generator: SlideGenerator) -> None:
    """Set the global slide generator."""
    global _slide_generator
    _slide_generator = generator
