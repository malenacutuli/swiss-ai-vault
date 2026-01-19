"""
Analytics & Reporting Module

Implements analytics functionality with:
- Event tracking and collection
- Metrics aggregation with time windows
- Report generation with templates
- Dashboard building with widgets
- Insights and trend analysis
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union
from abc import ABC, abstractmethod
from collections import defaultdict
import time
import math
import statistics


# ==================== Enums ====================

class EventCategory(Enum):
    """Categories of analytics events."""
    USER_ACTION = "user_action"
    SYSTEM = "system"
    PERFORMANCE = "performance"
    ERROR = "error"
    SECURITY = "security"
    COLLABORATION = "collaboration"
    INTEGRATION = "integration"


class EventType(Enum):
    """Types of analytics events."""
    # User actions
    PAGE_VIEW = "page_view"
    CLICK = "click"
    SEARCH = "search"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    SHARE = "share"
    DOWNLOAD = "download"
    UPLOAD = "upload"
    LOGIN = "login"
    LOGOUT = "logout"
    # Collaboration
    DOCUMENT_OPEN = "document_open"
    DOCUMENT_EDIT = "document_edit"
    COMMENT_ADD = "comment_add"
    MENTION = "mention"
    # System
    API_CALL = "api_call"
    WEBHOOK = "webhook"
    SYNC = "sync"
    JOB_RUN = "job_run"
    # Errors
    ERROR = "error"
    WARNING = "warning"
    # Custom
    CUSTOM = "custom"


class AggregationPeriod(Enum):
    """Time periods for aggregation."""
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class MetricType(Enum):
    """Types of metrics."""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    RATE = "rate"
    PERCENTAGE = "percentage"


class WidgetType(Enum):
    """Types of dashboard widgets."""
    LINE_CHART = "line_chart"
    BAR_CHART = "bar_chart"
    PIE_CHART = "pie_chart"
    AREA_CHART = "area_chart"
    NUMBER = "number"
    TABLE = "table"
    HEATMAP = "heatmap"
    FUNNEL = "funnel"
    LIST = "list"


class ReportFormat(Enum):
    """Report output formats."""
    JSON = "json"
    CSV = "csv"
    HTML = "html"
    PDF = "pdf"


class TrendDirection(Enum):
    """Trend direction indicators."""
    UP = "up"
    DOWN = "down"
    STABLE = "stable"


# ==================== Data Classes ====================

@dataclass
class AnalyticsEvent:
    """An analytics event."""
    id: str
    event_type: EventType
    category: EventCategory
    timestamp: datetime = field(default_factory=datetime.utcnow)
    user_id: Optional[str] = None
    workspace_id: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    properties: Dict[str, Any] = field(default_factory=dict)
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    duration_ms: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "event_type": self.event_type.value,
            "category": self.category.value,
            "timestamp": self.timestamp.isoformat(),
            "user_id": self.user_id,
            "workspace_id": self.workspace_id,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "properties": self.properties,
            "duration_ms": self.duration_ms,
        }


@dataclass
class MetricValue:
    """A metric value at a point in time."""
    name: str
    value: float
    metric_type: MetricType
    timestamp: datetime = field(default_factory=datetime.utcnow)
    tags: Dict[str, str] = field(default_factory=dict)
    unit: str = ""


@dataclass
class AggregatedMetric:
    """Aggregated metric over a time period."""
    name: str
    period: AggregationPeriod
    start_time: datetime
    end_time: datetime
    count: int = 0
    sum_value: float = 0.0
    min_value: float = float('inf')
    max_value: float = float('-inf')
    values: List[float] = field(default_factory=list)
    tags: Dict[str, str] = field(default_factory=dict)

    @property
    def avg_value(self) -> float:
        """Get average value."""
        return self.sum_value / self.count if self.count > 0 else 0.0

    @property
    def median_value(self) -> float:
        """Get median value."""
        if not self.values:
            return 0.0
        return statistics.median(self.values)

    @property
    def std_dev(self) -> float:
        """Get standard deviation."""
        if len(self.values) < 2:
            return 0.0
        return statistics.stdev(self.values)

    def add_value(self, value: float) -> None:
        """Add a value to the aggregation."""
        self.count += 1
        self.sum_value += value
        self.min_value = min(self.min_value, value)
        self.max_value = max(self.max_value, value)
        self.values.append(value)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "period": self.period.value,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "count": self.count,
            "sum": self.sum_value,
            "avg": self.avg_value,
            "min": self.min_value if self.count > 0 else 0,
            "max": self.max_value if self.count > 0 else 0,
            "median": self.median_value,
            "std_dev": self.std_dev,
            "tags": self.tags,
        }


@dataclass
class TimeSeriesPoint:
    """A point in a time series."""
    timestamp: datetime
    value: float
    label: str = ""


@dataclass
class TimeSeries:
    """A time series of data points."""
    name: str
    points: List[TimeSeriesPoint] = field(default_factory=list)
    unit: str = ""
    tags: Dict[str, str] = field(default_factory=dict)

    def add_point(self, timestamp: datetime, value: float, label: str = "") -> None:
        """Add a point to the series."""
        self.points.append(TimeSeriesPoint(timestamp, value, label))

    def get_values(self) -> List[float]:
        """Get all values."""
        return [p.value for p in self.points]

    def get_trend(self) -> TrendDirection:
        """Determine trend direction."""
        if len(self.points) < 2:
            return TrendDirection.STABLE

        values = self.get_values()
        first_half = sum(values[:len(values)//2]) / (len(values)//2)
        second_half = sum(values[len(values)//2:]) / (len(values) - len(values)//2)

        diff_pct = (second_half - first_half) / first_half if first_half != 0 else 0

        if diff_pct > 0.05:
            return TrendDirection.UP
        elif diff_pct < -0.05:
            return TrendDirection.DOWN
        return TrendDirection.STABLE


@dataclass
class Insight:
    """An analytics insight."""
    id: str
    title: str
    description: str
    metric_name: str
    trend: TrendDirection
    change_percent: float
    significance: float  # 0-1 score
    period: AggregationPeriod
    generated_at: datetime = field(default_factory=datetime.utcnow)
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "metric_name": self.metric_name,
            "trend": self.trend.value,
            "change_percent": self.change_percent,
            "significance": self.significance,
            "period": self.period.value,
            "recommendations": self.recommendations,
        }


@dataclass
class Widget:
    """A dashboard widget."""
    id: str
    title: str
    widget_type: WidgetType
    metric_name: str
    config: Dict[str, Any] = field(default_factory=dict)
    position: Tuple[int, int] = (0, 0)  # (row, col)
    size: Tuple[int, int] = (1, 1)  # (height, width)
    refresh_interval: int = 60  # seconds


@dataclass
class Dashboard:
    """A dashboard configuration."""
    id: str
    name: str
    workspace_id: str
    widgets: List[Widget] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    is_default: bool = False
    filters: Dict[str, Any] = field(default_factory=dict)

    def add_widget(self, widget: Widget) -> None:
        """Add a widget to the dashboard."""
        self.widgets.append(widget)
        self.updated_at = datetime.utcnow()

    def remove_widget(self, widget_id: str) -> bool:
        """Remove a widget from the dashboard."""
        for i, w in enumerate(self.widgets):
            if w.id == widget_id:
                self.widgets.pop(i)
                self.updated_at = datetime.utcnow()
                return True
        return False


@dataclass
class ReportTemplate:
    """A report template."""
    id: str
    name: str
    description: str = ""
    metrics: List[str] = field(default_factory=list)
    sections: List[Dict[str, Any]] = field(default_factory=list)
    filters: Dict[str, Any] = field(default_factory=dict)
    schedule: Optional[str] = None  # Cron expression
    format: ReportFormat = ReportFormat.JSON


@dataclass
class Report:
    """A generated report."""
    id: str
    template_id: str
    name: str
    generated_at: datetime = field(default_factory=datetime.utcnow)
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    data: Dict[str, Any] = field(default_factory=dict)
    format: ReportFormat = ReportFormat.JSON
    file_path: Optional[str] = None


@dataclass
class AnalyticsConfig:
    """Configuration for analytics."""
    retention_days: int = 90
    batch_size: int = 100
    flush_interval: int = 60  # seconds
    enable_sampling: bool = False
    sample_rate: float = 1.0
    excluded_events: Set[EventType] = field(default_factory=set)
    anonymize_ip: bool = True


# ==================== Event Tracker ====================

class EventTracker:
    """Tracks analytics events."""

    _counter: int = 0

    def __init__(self, config: Optional[AnalyticsConfig] = None):
        self.config = config or AnalyticsConfig()
        self._events: List[AnalyticsEvent] = []
        self._event_handlers: List[Callable[[AnalyticsEvent], None]] = []

    def track(
        self,
        event_type: EventType,
        category: EventCategory = EventCategory.USER_ACTION,
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
        duration_ms: Optional[int] = None
    ) -> AnalyticsEvent:
        """Track an event."""
        # Check if event should be excluded
        if event_type in self.config.excluded_events:
            return None

        # Apply sampling if enabled
        if self.config.enable_sampling:
            import random
            if random.random() > self.config.sample_rate:
                return None

        EventTracker._counter += 1
        event_id = f"evt_{int(time.time() * 1000)}_{EventTracker._counter}"

        event = AnalyticsEvent(
            id=event_id,
            event_type=event_type,
            category=category,
            user_id=user_id,
            workspace_id=workspace_id,
            resource_type=resource_type,
            resource_id=resource_id,
            properties=properties or {},
            session_id=session_id,
            duration_ms=duration_ms
        )

        self._events.append(event)

        # Notify handlers
        for handler in self._event_handlers:
            try:
                handler(event)
            except Exception:
                pass

        return event

    def track_page_view(
        self,
        page: str,
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        **properties
    ) -> AnalyticsEvent:
        """Track a page view."""
        return self.track(
            EventType.PAGE_VIEW,
            EventCategory.USER_ACTION,
            user_id=user_id,
            workspace_id=workspace_id,
            properties={"page": page, **properties}
        )

    def track_action(
        self,
        action: str,
        user_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        **properties
    ) -> AnalyticsEvent:
        """Track a user action."""
        event_type = EventType.CUSTOM
        if action == "create":
            event_type = EventType.CREATE
        elif action == "update":
            event_type = EventType.UPDATE
        elif action == "delete":
            event_type = EventType.DELETE
        elif action == "click":
            event_type = EventType.CLICK

        return self.track(
            event_type,
            EventCategory.USER_ACTION,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            properties={"action": action, **properties}
        )

    def track_error(
        self,
        error_type: str,
        message: str,
        user_id: Optional[str] = None,
        **properties
    ) -> AnalyticsEvent:
        """Track an error."""
        return self.track(
            EventType.ERROR,
            EventCategory.ERROR,
            user_id=user_id,
            properties={"error_type": error_type, "message": message, **properties}
        )

    def track_performance(
        self,
        operation: str,
        duration_ms: int,
        **properties
    ) -> AnalyticsEvent:
        """Track a performance metric."""
        return self.track(
            EventType.API_CALL,
            EventCategory.PERFORMANCE,
            duration_ms=duration_ms,
            properties={"operation": operation, **properties}
        )

    def on_event(self, handler: Callable[[AnalyticsEvent], None]) -> None:
        """Register an event handler."""
        self._event_handlers.append(handler)

    def get_events(
        self,
        event_type: Optional[EventType] = None,
        category: Optional[EventCategory] = None,
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[AnalyticsEvent]:
        """Get events matching criteria."""
        events = self._events

        if event_type:
            events = [e for e in events if e.event_type == event_type]
        if category:
            events = [e for e in events if e.category == category]
        if user_id:
            events = [e for e in events if e.user_id == user_id]
        if workspace_id:
            events = [e for e in events if e.workspace_id == workspace_id]
        if start_time:
            events = [e for e in events if e.timestamp >= start_time]
        if end_time:
            events = [e for e in events if e.timestamp <= end_time]

        return events[-limit:]

    def clear_events(self, before: Optional[datetime] = None) -> int:
        """Clear events, optionally before a date."""
        if before is None:
            count = len(self._events)
            self._events = []
            return count

        original_count = len(self._events)
        self._events = [e for e in self._events if e.timestamp >= before]
        return original_count - len(self._events)


# ==================== Metrics Aggregator ====================

class MetricsAggregator:
    """Aggregates metrics over time periods."""

    def __init__(self):
        self._metrics: Dict[str, List[MetricValue]] = defaultdict(list)
        self._aggregations: Dict[str, Dict[str, AggregatedMetric]] = defaultdict(dict)

    def record(
        self,
        name: str,
        value: float,
        metric_type: MetricType = MetricType.GAUGE,
        tags: Optional[Dict[str, str]] = None,
        unit: str = ""
    ) -> MetricValue:
        """Record a metric value."""
        metric = MetricValue(
            name=name,
            value=value,
            metric_type=metric_type,
            tags=tags or {},
            unit=unit
        )
        self._metrics[name].append(metric)
        return metric

    def increment(
        self,
        name: str,
        value: float = 1.0,
        tags: Optional[Dict[str, str]] = None
    ) -> MetricValue:
        """Increment a counter metric."""
        return self.record(name, value, MetricType.COUNTER, tags)

    def gauge(
        self,
        name: str,
        value: float,
        tags: Optional[Dict[str, str]] = None,
        unit: str = ""
    ) -> MetricValue:
        """Record a gauge metric."""
        return self.record(name, value, MetricType.GAUGE, tags, unit)

    def histogram(
        self,
        name: str,
        value: float,
        tags: Optional[Dict[str, str]] = None,
        unit: str = ""
    ) -> MetricValue:
        """Record a histogram metric."""
        return self.record(name, value, MetricType.HISTOGRAM, tags, unit)

    def aggregate(
        self,
        name: str,
        period: AggregationPeriod,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> AggregatedMetric:
        """Aggregate a metric over a time period."""
        end_time = end_time or datetime.utcnow()

        if period == AggregationPeriod.MINUTE:
            delta = timedelta(minutes=1)
        elif period == AggregationPeriod.HOUR:
            delta = timedelta(hours=1)
        elif period == AggregationPeriod.DAY:
            delta = timedelta(days=1)
        elif period == AggregationPeriod.WEEK:
            delta = timedelta(weeks=1)
        else:  # MONTH
            delta = timedelta(days=30)

        start_time = start_time or (end_time - delta)

        agg = AggregatedMetric(
            name=name,
            period=period,
            start_time=start_time,
            end_time=end_time
        )

        for metric in self._metrics.get(name, []):
            if start_time <= metric.timestamp <= end_time:
                agg.add_value(metric.value)

        return agg

    def get_time_series(
        self,
        name: str,
        period: AggregationPeriod,
        num_periods: int = 24,
        end_time: Optional[datetime] = None
    ) -> TimeSeries:
        """Get a time series of aggregated values."""
        end_time = end_time or datetime.utcnow()

        if period == AggregationPeriod.MINUTE:
            delta = timedelta(minutes=1)
        elif period == AggregationPeriod.HOUR:
            delta = timedelta(hours=1)
        elif period == AggregationPeriod.DAY:
            delta = timedelta(days=1)
        elif period == AggregationPeriod.WEEK:
            delta = timedelta(weeks=1)
        else:  # MONTH
            delta = timedelta(days=30)

        series = TimeSeries(name=name)

        for i in range(num_periods):
            period_end = end_time - (delta * i)
            period_start = period_end - delta

            agg = self.aggregate(name, period, period_start, period_end)
            series.add_point(period_start, agg.avg_value)

        # Reverse to chronological order
        series.points.reverse()
        return series

    def get_top_values(
        self,
        name: str,
        group_by: str,
        limit: int = 10,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[Tuple[str, float]]:
        """Get top values grouped by a tag."""
        groups: Dict[str, float] = defaultdict(float)

        for metric in self._metrics.get(name, []):
            if start_time and metric.timestamp < start_time:
                continue
            if end_time and metric.timestamp > end_time:
                continue

            group_value = metric.tags.get(group_by, "unknown")
            groups[group_value] += metric.value

        sorted_groups = sorted(groups.items(), key=lambda x: x[1], reverse=True)
        return sorted_groups[:limit]

    def get_percentile(
        self,
        name: str,
        percentile: float,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> float:
        """Get a percentile value for a metric."""
        values = []
        for metric in self._metrics.get(name, []):
            if start_time and metric.timestamp < start_time:
                continue
            if end_time and metric.timestamp > end_time:
                continue
            values.append(metric.value)

        if not values:
            return 0.0

        values.sort()
        idx = int(len(values) * (percentile / 100))
        return values[min(idx, len(values) - 1)]

    def get_metric_names(self) -> List[str]:
        """Get all metric names."""
        return list(self._metrics.keys())

    def clear_metrics(self, before: Optional[datetime] = None) -> int:
        """Clear metrics, optionally before a date."""
        if before is None:
            count = sum(len(v) for v in self._metrics.values())
            self._metrics.clear()
            return count

        count = 0
        for name in list(self._metrics.keys()):
            original = len(self._metrics[name])
            self._metrics[name] = [
                m for m in self._metrics[name]
                if m.timestamp >= before
            ]
            count += original - len(self._metrics[name])

        return count


# ==================== Insights Engine ====================

class InsightsEngine:
    """Generates insights from analytics data."""

    _counter: int = 0

    def __init__(self, aggregator: MetricsAggregator):
        self.aggregator = aggregator

    def analyze_trend(
        self,
        metric_name: str,
        period: AggregationPeriod = AggregationPeriod.DAY,
        num_periods: int = 7
    ) -> Optional[Insight]:
        """Analyze trend for a metric."""
        series = self.aggregator.get_time_series(
            metric_name, period, num_periods
        )

        if len(series.points) < 2:
            return None

        values = series.get_values()
        if not any(v != 0 for v in values):
            return None

        trend = series.get_trend()

        # Calculate change percentage
        first_value = values[0] if values[0] != 0 else 1
        last_value = values[-1]
        change_pct = ((last_value - first_value) / abs(first_value)) * 100

        # Calculate significance (simple: based on std dev)
        if len(values) >= 2:
            std = statistics.stdev(values)
            mean = statistics.mean(values)
            significance = min(1.0, std / mean if mean != 0 else 0)
        else:
            significance = 0.0

        InsightsEngine._counter += 1
        insight_id = f"insight_{int(time.time() * 1000)}_{InsightsEngine._counter}"

        # Generate title and description
        if trend == TrendDirection.UP:
            title = f"{metric_name} is increasing"
            description = f"{metric_name} increased by {abs(change_pct):.1f}% over the last {num_periods} {period.value}s"
        elif trend == TrendDirection.DOWN:
            title = f"{metric_name} is decreasing"
            description = f"{metric_name} decreased by {abs(change_pct):.1f}% over the last {num_periods} {period.value}s"
        else:
            title = f"{metric_name} is stable"
            description = f"{metric_name} remained stable over the last {num_periods} {period.value}s"

        return Insight(
            id=insight_id,
            title=title,
            description=description,
            metric_name=metric_name,
            trend=trend,
            change_percent=change_pct,
            significance=significance,
            period=period
        )

    def detect_anomalies(
        self,
        metric_name: str,
        threshold_std: float = 2.0,
        period: AggregationPeriod = AggregationPeriod.HOUR,
        num_periods: int = 24
    ) -> List[TimeSeriesPoint]:
        """Detect anomalies in a metric."""
        series = self.aggregator.get_time_series(
            metric_name, period, num_periods
        )

        if len(series.points) < 3:
            return []

        values = series.get_values()
        mean = statistics.mean(values)
        std = statistics.stdev(values) if len(values) >= 2 else 0

        if std == 0:
            return []

        anomalies = []
        for point in series.points:
            z_score = abs(point.value - mean) / std
            if z_score > threshold_std:
                anomalies.append(point)

        return anomalies

    def compare_periods(
        self,
        metric_name: str,
        period: AggregationPeriod = AggregationPeriod.DAY
    ) -> Dict[str, Any]:
        """Compare current period with previous period."""
        now = datetime.utcnow()

        if period == AggregationPeriod.HOUR:
            delta = timedelta(hours=1)
        elif period == AggregationPeriod.DAY:
            delta = timedelta(days=1)
        elif period == AggregationPeriod.WEEK:
            delta = timedelta(weeks=1)
        else:
            delta = timedelta(days=30)

        current = self.aggregator.aggregate(
            metric_name, period, now - delta, now
        )
        previous = self.aggregator.aggregate(
            metric_name, period, now - (delta * 2), now - delta
        )

        change = current.sum_value - previous.sum_value
        change_pct = (change / previous.sum_value * 100) if previous.sum_value != 0 else 0

        return {
            "current": current.to_dict(),
            "previous": previous.to_dict(),
            "change": change,
            "change_percent": change_pct,
            "trend": TrendDirection.UP.value if change > 0 else (
                TrendDirection.DOWN.value if change < 0 else TrendDirection.STABLE.value
            )
        }

    def generate_summary(
        self,
        metric_names: List[str],
        period: AggregationPeriod = AggregationPeriod.DAY
    ) -> Dict[str, Any]:
        """Generate a summary of multiple metrics."""
        summary = {
            "period": period.value,
            "generated_at": datetime.utcnow().isoformat(),
            "metrics": {},
            "insights": []
        }

        for name in metric_names:
            agg = self.aggregator.aggregate(name, period)
            summary["metrics"][name] = agg.to_dict()

            insight = self.analyze_trend(name, period)
            if insight and insight.significance > 0.1:
                summary["insights"].append(insight.to_dict())

        return summary


# ==================== Report Generator ====================

class ReportGenerator:
    """Generates reports from templates."""

    _counter: int = 0

    def __init__(
        self,
        tracker: EventTracker,
        aggregator: MetricsAggregator
    ):
        self.tracker = tracker
        self.aggregator = aggregator
        self._templates: Dict[str, ReportTemplate] = {}
        self._reports: Dict[str, Report] = {}

    def register_template(self, template: ReportTemplate) -> None:
        """Register a report template."""
        self._templates[template.id] = template

    def get_template(self, template_id: str) -> Optional[ReportTemplate]:
        """Get a template by ID."""
        return self._templates.get(template_id)

    def generate(
        self,
        template_id: str,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> Optional[Report]:
        """Generate a report from a template."""
        template = self._templates.get(template_id)
        if not template:
            return None

        period_end = period_end or datetime.utcnow()
        period_start = period_start or (period_end - timedelta(days=7))

        ReportGenerator._counter += 1
        report_id = f"report_{int(time.time() * 1000)}_{ReportGenerator._counter}"

        data = {
            "template": template.name,
            "period": {
                "start": period_start.isoformat(),
                "end": period_end.isoformat()
            },
            "sections": []
        }

        # Gather metrics data
        for section in template.sections:
            section_data = self._generate_section(
                section, period_start, period_end, filters
            )
            data["sections"].append(section_data)

        # Aggregate template metrics
        metrics_data = {}
        for metric_name in template.metrics:
            agg = self.aggregator.aggregate(
                metric_name,
                AggregationPeriod.DAY,
                period_start,
                period_end
            )
            metrics_data[metric_name] = agg.to_dict()
        data["metrics"] = metrics_data

        report = Report(
            id=report_id,
            template_id=template_id,
            name=f"{template.name} - {period_end.strftime('%Y-%m-%d')}",
            period_start=period_start,
            period_end=period_end,
            data=data,
            format=template.format
        )

        self._reports[report_id] = report
        return report

    def _generate_section(
        self,
        section: Dict[str, Any],
        period_start: datetime,
        period_end: datetime,
        filters: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate a report section."""
        section_type = section.get("type", "metrics")
        section_data = {
            "title": section.get("title", ""),
            "type": section_type,
            "data": {}
        }

        if section_type == "metrics":
            for metric in section.get("metrics", []):
                agg = self.aggregator.aggregate(
                    metric, AggregationPeriod.DAY, period_start, period_end
                )
                section_data["data"][metric] = agg.to_dict()

        elif section_type == "events":
            event_type = section.get("event_type")
            events = self.tracker.get_events(
                event_type=EventType(event_type) if event_type else None,
                start_time=period_start,
                end_time=period_end
            )
            section_data["data"]["events"] = [e.to_dict() for e in events[:100]]
            section_data["data"]["total"] = len(events)

        elif section_type == "top_users":
            # Would aggregate user activity
            section_data["data"]["users"] = []

        elif section_type == "comparison":
            metric = section.get("metric")
            if metric:
                insights = InsightsEngine(self.aggregator)
                section_data["data"] = insights.compare_periods(
                    metric, AggregationPeriod.DAY
                )

        return section_data

    def get_report(self, report_id: str) -> Optional[Report]:
        """Get a report by ID."""
        return self._reports.get(report_id)

    def list_reports(
        self,
        template_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Report]:
        """List generated reports."""
        reports = list(self._reports.values())
        if template_id:
            reports = [r for r in reports if r.template_id == template_id]
        reports.sort(key=lambda r: r.generated_at, reverse=True)
        return reports[:limit]

    def export_report(
        self,
        report_id: str,
        format: ReportFormat = ReportFormat.JSON
    ) -> Optional[str]:
        """Export a report to a format."""
        report = self._reports.get(report_id)
        if not report:
            return None

        if format == ReportFormat.JSON:
            import json
            return json.dumps(report.data, indent=2, default=str)

        elif format == ReportFormat.CSV:
            lines = []
            for section in report.data.get("sections", []):
                lines.append(f"# {section.get('title', '')}")
                if "metrics" in section.get("data", {}):
                    for name, data in section["data"].items():
                        lines.append(f"{name},{data.get('avg', 0)},{data.get('count', 0)}")
            return "\n".join(lines)

        elif format == ReportFormat.HTML:
            html = f"<html><head><title>{report.name}</title></head><body>"
            html += f"<h1>{report.name}</h1>"
            for section in report.data.get("sections", []):
                html += f"<h2>{section.get('title', '')}</h2>"
                html += f"<pre>{section.get('data', {})}</pre>"
            html += "</body></html>"
            return html

        return None


# ==================== Dashboard Builder ====================

class DashboardBuilder:
    """Builds and manages dashboards."""

    _counter: int = 0

    def __init__(self, aggregator: MetricsAggregator):
        self.aggregator = aggregator
        self._dashboards: Dict[str, Dashboard] = {}
        self._widget_counter: int = 0

    def create_dashboard(
        self,
        name: str,
        workspace_id: str,
        created_by: Optional[str] = None
    ) -> Dashboard:
        """Create a new dashboard."""
        DashboardBuilder._counter += 1
        dashboard_id = f"dash_{int(time.time() * 1000)}_{DashboardBuilder._counter}"

        dashboard = Dashboard(
            id=dashboard_id,
            name=name,
            workspace_id=workspace_id,
            created_by=created_by
        )

        self._dashboards[dashboard_id] = dashboard
        return dashboard

    def get_dashboard(self, dashboard_id: str) -> Optional[Dashboard]:
        """Get a dashboard by ID."""
        return self._dashboards.get(dashboard_id)

    def list_dashboards(
        self,
        workspace_id: Optional[str] = None
    ) -> List[Dashboard]:
        """List dashboards."""
        dashboards = list(self._dashboards.values())
        if workspace_id:
            dashboards = [d for d in dashboards if d.workspace_id == workspace_id]
        return dashboards

    def delete_dashboard(self, dashboard_id: str) -> bool:
        """Delete a dashboard."""
        if dashboard_id in self._dashboards:
            del self._dashboards[dashboard_id]
            return True
        return False

    def create_widget(
        self,
        title: str,
        widget_type: WidgetType,
        metric_name: str,
        config: Optional[Dict[str, Any]] = None,
        position: Tuple[int, int] = (0, 0),
        size: Tuple[int, int] = (1, 1)
    ) -> Widget:
        """Create a widget."""
        self._widget_counter += 1
        widget_id = f"widget_{int(time.time() * 1000)}_{self._widget_counter}"

        return Widget(
            id=widget_id,
            title=title,
            widget_type=widget_type,
            metric_name=metric_name,
            config=config or {},
            position=position,
            size=size
        )

    def add_widget_to_dashboard(
        self,
        dashboard_id: str,
        widget: Widget
    ) -> bool:
        """Add a widget to a dashboard."""
        dashboard = self._dashboards.get(dashboard_id)
        if not dashboard:
            return False
        dashboard.add_widget(widget)
        return True

    def remove_widget_from_dashboard(
        self,
        dashboard_id: str,
        widget_id: str
    ) -> bool:
        """Remove a widget from a dashboard."""
        dashboard = self._dashboards.get(dashboard_id)
        if not dashboard:
            return False
        return dashboard.remove_widget(widget_id)

    def get_widget_data(
        self,
        widget: Widget,
        period: AggregationPeriod = AggregationPeriod.HOUR,
        num_periods: int = 24
    ) -> Dict[str, Any]:
        """Get data for a widget."""
        data: Dict[str, Any] = {
            "widget_id": widget.id,
            "title": widget.title,
            "type": widget.widget_type.value,
        }

        if widget.widget_type in [WidgetType.LINE_CHART, WidgetType.AREA_CHART]:
            series = self.aggregator.get_time_series(
                widget.metric_name, period, num_periods
            )
            data["series"] = [
                {"timestamp": p.timestamp.isoformat(), "value": p.value}
                for p in series.points
            ]
            data["trend"] = series.get_trend().value

        elif widget.widget_type == WidgetType.NUMBER:
            agg = self.aggregator.aggregate(widget.metric_name, period)
            data["value"] = agg.sum_value if agg.count > 0 else 0
            data["count"] = agg.count

        elif widget.widget_type == WidgetType.BAR_CHART:
            group_by = widget.config.get("group_by", "category")
            top_values = self.aggregator.get_top_values(
                widget.metric_name, group_by, limit=10
            )
            data["bars"] = [{"label": k, "value": v} for k, v in top_values]

        elif widget.widget_type == WidgetType.PIE_CHART:
            group_by = widget.config.get("group_by", "category")
            top_values = self.aggregator.get_top_values(
                widget.metric_name, group_by, limit=8
            )
            total = sum(v for _, v in top_values)
            data["slices"] = [
                {"label": k, "value": v, "percent": (v/total*100) if total else 0}
                for k, v in top_values
            ]

        elif widget.widget_type == WidgetType.TABLE:
            # Return raw metric data
            agg = self.aggregator.aggregate(widget.metric_name, period)
            data["rows"] = [agg.to_dict()]

        return data

    def render_dashboard(
        self,
        dashboard_id: str,
        period: AggregationPeriod = AggregationPeriod.HOUR
    ) -> Optional[Dict[str, Any]]:
        """Render a dashboard with all widget data."""
        dashboard = self._dashboards.get(dashboard_id)
        if not dashboard:
            return None

        return {
            "id": dashboard.id,
            "name": dashboard.name,
            "workspace_id": dashboard.workspace_id,
            "widgets": [
                self.get_widget_data(widget, period)
                for widget in dashboard.widgets
            ],
            "filters": dashboard.filters,
            "updated_at": dashboard.updated_at.isoformat(),
        }


# ==================== Analytics Manager ====================

class AnalyticsManager:
    """High-level manager for analytics."""

    def __init__(self, config: Optional[AnalyticsConfig] = None):
        self.config = config or AnalyticsConfig()
        self.tracker = EventTracker(self.config)
        self.aggregator = MetricsAggregator()
        self.insights = InsightsEngine(self.aggregator)
        self.reports = ReportGenerator(self.tracker, self.aggregator)
        self.dashboards = DashboardBuilder(self.aggregator)

        # Connect tracker to aggregator
        self.tracker.on_event(self._on_event)

    def _on_event(self, event: AnalyticsEvent) -> None:
        """Handle tracked events for metrics."""
        # Auto-record event counts
        self.aggregator.increment(
            f"events.{event.event_type.value}",
            tags={"category": event.category.value}
        )

        if event.workspace_id:
            self.aggregator.increment(
                f"events.by_workspace",
                tags={"workspace_id": event.workspace_id}
            )

        if event.user_id:
            self.aggregator.increment(
                f"events.by_user",
                tags={"user_id": event.user_id}
            )

        if event.duration_ms:
            self.aggregator.histogram(
                f"duration.{event.event_type.value}",
                event.duration_ms,
                unit="ms"
            )

    def track(self, *args, **kwargs) -> AnalyticsEvent:
        """Track an event."""
        return self.tracker.track(*args, **kwargs)

    def record_metric(self, *args, **kwargs) -> MetricValue:
        """Record a metric."""
        return self.aggregator.record(*args, **kwargs)

    def get_insights(
        self,
        metric_names: Optional[List[str]] = None,
        period: AggregationPeriod = AggregationPeriod.DAY
    ) -> List[Insight]:
        """Get insights for metrics."""
        if metric_names is None:
            metric_names = self.aggregator.get_metric_names()

        insights = []
        for name in metric_names:
            insight = self.insights.analyze_trend(name, period)
            if insight:
                insights.append(insight)

        # Sort by significance
        insights.sort(key=lambda i: i.significance, reverse=True)
        return insights

    def get_summary(
        self,
        workspace_id: Optional[str] = None,
        period: AggregationPeriod = AggregationPeriod.DAY
    ) -> Dict[str, Any]:
        """Get analytics summary."""
        # Get event counts
        events = self.tracker.get_events(workspace_id=workspace_id)
        event_counts = defaultdict(int)
        for event in events:
            event_counts[event.event_type.value] += 1

        # Get metric summaries
        metric_names = self.aggregator.get_metric_names()
        metrics = {}
        for name in metric_names[:20]:  # Limit to top 20
            agg = self.aggregator.aggregate(name, period)
            metrics[name] = {
                "count": agg.count,
                "sum": agg.sum_value,
                "avg": agg.avg_value,
            }

        return {
            "period": period.value,
            "total_events": len(events),
            "event_counts": dict(event_counts),
            "metrics": metrics,
            "generated_at": datetime.utcnow().isoformat(),
        }

    def cleanup(self, retention_days: Optional[int] = None) -> Dict[str, int]:
        """Clean up old data."""
        days = retention_days or self.config.retention_days
        cutoff = datetime.utcnow() - timedelta(days=days)

        events_cleared = self.tracker.clear_events(cutoff)
        metrics_cleared = self.aggregator.clear_metrics(cutoff)

        return {
            "events_cleared": events_cleared,
            "metrics_cleared": metrics_cleared,
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get analytics system stats."""
        return {
            "total_events": len(self.tracker._events),
            "total_metrics": sum(
                len(v) for v in self.aggregator._metrics.values()
            ),
            "metric_names": len(self.aggregator.get_metric_names()),
            "dashboards": len(self.dashboards._dashboards),
            "report_templates": len(self.reports._templates),
            "reports": len(self.reports._reports),
        }


# ==================== Global Instances ====================

_analytics_manager: Optional[AnalyticsManager] = None


def get_analytics_manager() -> Optional[AnalyticsManager]:
    """Get the global analytics manager."""
    return _analytics_manager


def set_analytics_manager(manager: AnalyticsManager) -> None:
    """Set the global analytics manager."""
    global _analytics_manager
    _analytics_manager = manager


def reset_analytics_manager() -> None:
    """Reset the global analytics manager."""
    global _analytics_manager
    _analytics_manager = None
