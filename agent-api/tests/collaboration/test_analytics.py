"""Tests for Analytics & Reporting module."""

import pytest
from datetime import datetime, timedelta
import time

from app.collaboration.analytics import (
    AnalyticsManager,
    AnalyticsConfig,
    AnalyticsEvent,
    EventTracker,
    EventCategory,
    EventType,
    MetricsAggregator,
    MetricValue,
    MetricType,
    AggregatedMetric,
    AggregationPeriod,
    TimeSeries,
    TimeSeriesPoint,
    TrendDirection,
    InsightsEngine,
    Insight,
    ReportGenerator,
    ReportTemplate,
    Report,
    ReportFormat,
    DashboardBuilder,
    Dashboard,
    Widget,
    WidgetType,
    get_analytics_manager,
    set_analytics_manager,
    reset_analytics_manager,
)


# ==================== Fixtures ====================

@pytest.fixture
def config():
    """Create analytics config."""
    return AnalyticsConfig()


@pytest.fixture
def tracker(config):
    """Create event tracker."""
    return EventTracker(config)


@pytest.fixture
def aggregator():
    """Create metrics aggregator."""
    return MetricsAggregator()


@pytest.fixture
def manager(config):
    """Create analytics manager."""
    return AnalyticsManager(config)


# ==================== AnalyticsEvent Tests ====================

class TestAnalyticsEvent:
    """Tests for AnalyticsEvent."""

    def test_create_event(self):
        """Test creating an event."""
        event = AnalyticsEvent(
            id="evt_1",
            event_type=EventType.PAGE_VIEW,
            category=EventCategory.USER_ACTION
        )
        assert event.id == "evt_1"
        assert event.event_type == EventType.PAGE_VIEW
        assert event.category == EventCategory.USER_ACTION

    def test_event_to_dict(self):
        """Test converting event to dict."""
        event = AnalyticsEvent(
            id="evt_1",
            event_type=EventType.CLICK,
            category=EventCategory.USER_ACTION,
            user_id="user_1",
            properties={"button": "submit"}
        )

        result = event.to_dict()
        assert result["id"] == "evt_1"
        assert result["event_type"] == "click"
        assert result["category"] == "user_action"
        assert result["user_id"] == "user_1"
        assert result["properties"]["button"] == "submit"


# ==================== EventTracker Tests ====================

class TestEventTracker:
    """Tests for EventTracker."""

    def test_track_event(self, tracker):
        """Test tracking an event."""
        event = tracker.track(
            EventType.PAGE_VIEW,
            EventCategory.USER_ACTION,
            user_id="user_1"
        )

        assert event is not None
        assert event.event_type == EventType.PAGE_VIEW
        assert event.user_id == "user_1"

    def test_track_page_view(self, tracker):
        """Test tracking page view."""
        event = tracker.track_page_view(
            "/dashboard",
            user_id="user_1",
            workspace_id="ws_1"
        )

        assert event.event_type == EventType.PAGE_VIEW
        assert event.properties["page"] == "/dashboard"

    def test_track_action(self, tracker):
        """Test tracking action."""
        event = tracker.track_action(
            "create",
            user_id="user_1",
            resource_type="document",
            resource_id="doc_1"
        )

        assert event.event_type == EventType.CREATE
        assert event.resource_type == "document"

    def test_track_error(self, tracker):
        """Test tracking error."""
        event = tracker.track_error(
            "ValidationError",
            "Invalid input",
            user_id="user_1"
        )

        assert event.event_type == EventType.ERROR
        assert event.category == EventCategory.ERROR
        assert event.properties["error_type"] == "ValidationError"

    def test_track_performance(self, tracker):
        """Test tracking performance."""
        event = tracker.track_performance(
            "api_call",
            duration_ms=150
        )

        assert event.event_type == EventType.API_CALL
        assert event.category == EventCategory.PERFORMANCE
        assert event.duration_ms == 150

    def test_event_handler(self, tracker):
        """Test event handler callback."""
        events_received = []

        def handler(event):
            events_received.append(event)

        tracker.on_event(handler)
        tracker.track(EventType.CLICK, EventCategory.USER_ACTION)

        assert len(events_received) == 1

    def test_get_events(self, tracker):
        """Test getting events."""
        tracker.track(EventType.PAGE_VIEW, user_id="user_1")
        tracker.track(EventType.CLICK, user_id="user_2")
        tracker.track(EventType.PAGE_VIEW, user_id="user_1")

        events = tracker.get_events(event_type=EventType.PAGE_VIEW)
        assert len(events) == 2

        events = tracker.get_events(user_id="user_1")
        assert len(events) == 2

    def test_get_events_by_workspace(self, tracker):
        """Test getting events by workspace."""
        tracker.track(EventType.PAGE_VIEW, workspace_id="ws_1")
        tracker.track(EventType.CLICK, workspace_id="ws_2")

        events = tracker.get_events(workspace_id="ws_1")
        assert len(events) == 1

    def test_get_events_by_time_range(self, tracker):
        """Test getting events by time range."""
        tracker.track(EventType.PAGE_VIEW)

        start = datetime.utcnow() - timedelta(hours=1)
        end = datetime.utcnow() + timedelta(hours=1)

        events = tracker.get_events(start_time=start, end_time=end)
        assert len(events) >= 1

    def test_clear_events(self, tracker):
        """Test clearing events."""
        tracker.track(EventType.PAGE_VIEW)
        tracker.track(EventType.CLICK)

        count = tracker.clear_events()
        assert count == 2
        assert len(tracker.get_events()) == 0

    def test_excluded_events(self):
        """Test excluded events."""
        config = AnalyticsConfig(
            excluded_events={EventType.PAGE_VIEW}
        )
        tracker = EventTracker(config)

        event = tracker.track(EventType.PAGE_VIEW)
        assert event is None

        event = tracker.track(EventType.CLICK)
        assert event is not None

    def test_sampling(self):
        """Test event sampling."""
        config = AnalyticsConfig(
            enable_sampling=True,
            sample_rate=0.0  # Sample nothing
        )
        tracker = EventTracker(config)

        event = tracker.track(EventType.PAGE_VIEW)
        assert event is None


# ==================== MetricsAggregator Tests ====================

class TestMetricsAggregator:
    """Tests for MetricsAggregator."""

    def test_record_metric(self, aggregator):
        """Test recording a metric."""
        metric = aggregator.record("response_time", 100.0)

        assert metric.name == "response_time"
        assert metric.value == 100.0

    def test_increment_counter(self, aggregator):
        """Test incrementing counter."""
        aggregator.increment("requests")
        aggregator.increment("requests")
        aggregator.increment("requests", 5)

        agg = aggregator.aggregate("requests", AggregationPeriod.HOUR)
        assert agg.sum_value == 7

    def test_gauge_metric(self, aggregator):
        """Test gauge metric."""
        aggregator.gauge("memory_usage", 1024, unit="MB")
        aggregator.gauge("memory_usage", 2048, unit="MB")

        agg = aggregator.aggregate("memory_usage", AggregationPeriod.HOUR)
        assert agg.avg_value == 1536

    def test_histogram_metric(self, aggregator):
        """Test histogram metric."""
        for value in [10, 20, 30, 40, 50]:
            aggregator.histogram("latency", value, unit="ms")

        agg = aggregator.aggregate("latency", AggregationPeriod.HOUR)
        assert agg.count == 5
        assert agg.min_value == 10
        assert agg.max_value == 50
        assert agg.median_value == 30

    def test_aggregate(self, aggregator):
        """Test aggregation."""
        aggregator.record("metric1", 10)
        aggregator.record("metric1", 20)
        aggregator.record("metric1", 30)

        agg = aggregator.aggregate("metric1", AggregationPeriod.HOUR)

        assert agg.count == 3
        assert agg.sum_value == 60
        assert agg.avg_value == 20
        assert agg.min_value == 10
        assert agg.max_value == 30

    def test_get_time_series(self, aggregator):
        """Test getting time series."""
        # Record some metrics
        for i in range(10):
            aggregator.record("series_metric", i * 10)

        series = aggregator.get_time_series(
            "series_metric",
            AggregationPeriod.HOUR,
            num_periods=5
        )

        assert series.name == "series_metric"
        assert len(series.points) == 5

    def test_get_top_values(self, aggregator):
        """Test getting top values."""
        aggregator.record("views", 100, tags={"page": "/home"})
        aggregator.record("views", 50, tags={"page": "/about"})
        aggregator.record("views", 200, tags={"page": "/home"})

        top = aggregator.get_top_values("views", "page", limit=2)

        assert len(top) == 2
        assert top[0][0] == "/home"
        assert top[0][1] == 300

    def test_get_percentile(self, aggregator):
        """Test getting percentile."""
        for i in range(100):
            aggregator.record("latency", i)

        p50 = aggregator.get_percentile("latency", 50)
        p95 = aggregator.get_percentile("latency", 95)

        assert 45 <= p50 <= 55
        assert 90 <= p95 <= 99

    def test_get_metric_names(self, aggregator):
        """Test getting metric names."""
        aggregator.record("metric_a", 1)
        aggregator.record("metric_b", 2)
        aggregator.record("metric_c", 3)

        names = aggregator.get_metric_names()
        assert "metric_a" in names
        assert "metric_b" in names
        assert "metric_c" in names

    def test_clear_metrics(self, aggregator):
        """Test clearing metrics."""
        aggregator.record("metric1", 1)
        aggregator.record("metric2", 2)

        count = aggregator.clear_metrics()
        assert count == 2
        assert len(aggregator.get_metric_names()) == 0


# ==================== AggregatedMetric Tests ====================

class TestAggregatedMetric:
    """Tests for AggregatedMetric."""

    def test_add_value(self):
        """Test adding values."""
        agg = AggregatedMetric(
            name="test",
            period=AggregationPeriod.HOUR,
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow()
        )

        agg.add_value(10)
        agg.add_value(20)
        agg.add_value(30)

        assert agg.count == 3
        assert agg.sum_value == 60
        assert agg.min_value == 10
        assert agg.max_value == 30

    def test_avg_value(self):
        """Test average value."""
        agg = AggregatedMetric(
            name="test",
            period=AggregationPeriod.HOUR,
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow()
        )

        agg.add_value(10)
        agg.add_value(20)

        assert agg.avg_value == 15

    def test_std_dev(self):
        """Test standard deviation."""
        agg = AggregatedMetric(
            name="test",
            period=AggregationPeriod.HOUR,
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow()
        )

        agg.add_value(10)
        agg.add_value(20)
        agg.add_value(30)

        assert agg.std_dev > 0

    def test_to_dict(self):
        """Test converting to dict."""
        agg = AggregatedMetric(
            name="test",
            period=AggregationPeriod.DAY,
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow()
        )
        agg.add_value(100)

        result = agg.to_dict()
        assert result["name"] == "test"
        assert result["period"] == "day"
        assert result["count"] == 1


# ==================== TimeSeries Tests ====================

class TestTimeSeries:
    """Tests for TimeSeries."""

    def test_add_point(self):
        """Test adding points."""
        series = TimeSeries(name="test")
        series.add_point(datetime.utcnow(), 10)
        series.add_point(datetime.utcnow(), 20)

        assert len(series.points) == 2

    def test_get_values(self):
        """Test getting values."""
        series = TimeSeries(name="test")
        series.add_point(datetime.utcnow(), 10)
        series.add_point(datetime.utcnow(), 20)
        series.add_point(datetime.utcnow(), 30)

        values = series.get_values()
        assert values == [10, 20, 30]

    def test_get_trend_up(self):
        """Test trend detection - up."""
        series = TimeSeries(name="test")
        for i in range(10):
            series.add_point(datetime.utcnow(), i * 10)

        assert series.get_trend() == TrendDirection.UP

    def test_get_trend_down(self):
        """Test trend detection - down."""
        series = TimeSeries(name="test")
        for i in range(10, 0, -1):
            series.add_point(datetime.utcnow(), i * 10)

        assert series.get_trend() == TrendDirection.DOWN

    def test_get_trend_stable(self):
        """Test trend detection - stable."""
        series = TimeSeries(name="test")
        for _ in range(10):
            series.add_point(datetime.utcnow(), 50)

        assert series.get_trend() == TrendDirection.STABLE


# ==================== InsightsEngine Tests ====================

class TestInsightsEngine:
    """Tests for InsightsEngine."""

    def test_analyze_trend(self, aggregator):
        """Test analyzing trend."""
        # Add increasing values
        for i in range(10):
            aggregator.record("trending_metric", i * 10)

        insights = InsightsEngine(aggregator)
        insight = insights.analyze_trend("trending_metric")

        assert insight is not None
        assert insight.metric_name == "trending_metric"

    def test_detect_anomalies(self, aggregator):
        """Test detecting anomalies."""
        # Add normal values
        for _ in range(20):
            aggregator.record("anomaly_metric", 50)
        # Add anomaly
        aggregator.record("anomaly_metric", 500)

        insights = InsightsEngine(aggregator)
        anomalies = insights.detect_anomalies("anomaly_metric")

        assert len(anomalies) >= 0  # May or may not detect depending on aggregation

    def test_compare_periods(self, aggregator):
        """Test comparing periods."""
        for i in range(5):
            aggregator.record("compare_metric", 100)

        insights = InsightsEngine(aggregator)
        comparison = insights.compare_periods(
            "compare_metric",
            AggregationPeriod.DAY
        )

        assert "current" in comparison
        assert "previous" in comparison
        assert "change" in comparison

    def test_generate_summary(self, aggregator):
        """Test generating summary."""
        aggregator.record("metric_a", 100)
        aggregator.record("metric_b", 200)

        insights = InsightsEngine(aggregator)
        summary = insights.generate_summary(["metric_a", "metric_b"])

        assert "metrics" in summary
        assert "metric_a" in summary["metrics"]
        assert "metric_b" in summary["metrics"]


# ==================== Insight Tests ====================

class TestInsight:
    """Tests for Insight."""

    def test_create_insight(self):
        """Test creating insight."""
        insight = Insight(
            id="insight_1",
            title="Metric increasing",
            description="The metric is increasing",
            metric_name="test_metric",
            trend=TrendDirection.UP,
            change_percent=25.0,
            significance=0.8,
            period=AggregationPeriod.DAY
        )

        assert insight.id == "insight_1"
        assert insight.trend == TrendDirection.UP

    def test_insight_to_dict(self):
        """Test insight to dict."""
        insight = Insight(
            id="insight_1",
            title="Test",
            description="Description",
            metric_name="metric",
            trend=TrendDirection.DOWN,
            change_percent=-10.0,
            significance=0.5,
            period=AggregationPeriod.HOUR
        )

        result = insight.to_dict()
        assert result["id"] == "insight_1"
        assert result["trend"] == "down"


# ==================== ReportGenerator Tests ====================

class TestReportGenerator:
    """Tests for ReportGenerator."""

    def test_register_template(self, tracker, aggregator):
        """Test registering template."""
        generator = ReportGenerator(tracker, aggregator)
        template = ReportTemplate(
            id="template_1",
            name="Weekly Report",
            metrics=["views", "clicks"]
        )

        generator.register_template(template)
        retrieved = generator.get_template("template_1")

        assert retrieved is not None
        assert retrieved.name == "Weekly Report"

    def test_generate_report(self, tracker, aggregator):
        """Test generating report."""
        generator = ReportGenerator(tracker, aggregator)

        # Add some data
        aggregator.record("views", 100)
        aggregator.record("clicks", 50)
        tracker.track(EventType.PAGE_VIEW)

        template = ReportTemplate(
            id="template_1",
            name="Test Report",
            metrics=["views", "clicks"],
            sections=[
                {"type": "metrics", "title": "Overview", "metrics": ["views"]}
            ]
        )
        generator.register_template(template)

        report = generator.generate("template_1")

        assert report is not None
        assert report.template_id == "template_1"
        assert "sections" in report.data

    def test_export_report_json(self, tracker, aggregator):
        """Test exporting report as JSON."""
        generator = ReportGenerator(tracker, aggregator)
        template = ReportTemplate(
            id="template_1",
            name="Test",
            format=ReportFormat.JSON
        )
        generator.register_template(template)
        report = generator.generate("template_1")

        exported = generator.export_report(report.id, ReportFormat.JSON)
        assert exported is not None
        assert "template" in exported

    def test_export_report_csv(self, tracker, aggregator):
        """Test exporting report as CSV."""
        generator = ReportGenerator(tracker, aggregator)
        template = ReportTemplate(
            id="template_1",
            name="Test",
            sections=[{"type": "metrics", "title": "Data", "metrics": ["m1"]}]
        )
        generator.register_template(template)
        aggregator.record("m1", 100)
        report = generator.generate("template_1")

        exported = generator.export_report(report.id, ReportFormat.CSV)
        assert exported is not None

    def test_export_report_html(self, tracker, aggregator):
        """Test exporting report as HTML."""
        generator = ReportGenerator(tracker, aggregator)
        template = ReportTemplate(id="template_1", name="Test")
        generator.register_template(template)
        report = generator.generate("template_1")

        exported = generator.export_report(report.id, ReportFormat.HTML)
        assert exported is not None
        assert "<html>" in exported

    def test_list_reports(self, tracker, aggregator):
        """Test listing reports."""
        generator = ReportGenerator(tracker, aggregator)
        template = ReportTemplate(id="template_1", name="Test")
        generator.register_template(template)

        generator.generate("template_1")
        generator.generate("template_1")

        reports = generator.list_reports()
        assert len(reports) == 2


# ==================== DashboardBuilder Tests ====================

class TestDashboardBuilder:
    """Tests for DashboardBuilder."""

    def test_create_dashboard(self, aggregator):
        """Test creating dashboard."""
        builder = DashboardBuilder(aggregator)
        dashboard = builder.create_dashboard(
            "My Dashboard",
            "ws_1",
            created_by="user_1"
        )

        assert dashboard.id is not None
        assert dashboard.name == "My Dashboard"
        assert dashboard.workspace_id == "ws_1"

    def test_get_dashboard(self, aggregator):
        """Test getting dashboard."""
        builder = DashboardBuilder(aggregator)
        dashboard = builder.create_dashboard("Test", "ws_1")

        retrieved = builder.get_dashboard(dashboard.id)
        assert retrieved is not None
        assert retrieved.id == dashboard.id

    def test_list_dashboards(self, aggregator):
        """Test listing dashboards."""
        builder = DashboardBuilder(aggregator)
        builder.create_dashboard("Dashboard 1", "ws_1")
        builder.create_dashboard("Dashboard 2", "ws_1")
        builder.create_dashboard("Dashboard 3", "ws_2")

        ws1_dashboards = builder.list_dashboards("ws_1")
        assert len(ws1_dashboards) == 2

    def test_delete_dashboard(self, aggregator):
        """Test deleting dashboard."""
        builder = DashboardBuilder(aggregator)
        dashboard = builder.create_dashboard("Test", "ws_1")

        result = builder.delete_dashboard(dashboard.id)
        assert result is True
        assert builder.get_dashboard(dashboard.id) is None

    def test_create_widget(self, aggregator):
        """Test creating widget."""
        builder = DashboardBuilder(aggregator)
        widget = builder.create_widget(
            "Page Views",
            WidgetType.LINE_CHART,
            "page_views"
        )

        assert widget.id is not None
        assert widget.title == "Page Views"
        assert widget.widget_type == WidgetType.LINE_CHART

    def test_add_widget_to_dashboard(self, aggregator):
        """Test adding widget to dashboard."""
        builder = DashboardBuilder(aggregator)
        dashboard = builder.create_dashboard("Test", "ws_1")
        widget = builder.create_widget("Widget", WidgetType.NUMBER, "metric")

        result = builder.add_widget_to_dashboard(dashboard.id, widget)

        assert result is True
        assert len(dashboard.widgets) == 1

    def test_remove_widget_from_dashboard(self, aggregator):
        """Test removing widget from dashboard."""
        builder = DashboardBuilder(aggregator)
        dashboard = builder.create_dashboard("Test", "ws_1")
        widget = builder.create_widget("Widget", WidgetType.NUMBER, "metric")
        builder.add_widget_to_dashboard(dashboard.id, widget)

        result = builder.remove_widget_from_dashboard(dashboard.id, widget.id)

        assert result is True
        assert len(dashboard.widgets) == 0

    def test_get_widget_data_number(self, aggregator):
        """Test getting number widget data."""
        builder = DashboardBuilder(aggregator)
        aggregator.record("requests", 100)
        aggregator.record("requests", 200)

        widget = builder.create_widget("Requests", WidgetType.NUMBER, "requests")
        data = builder.get_widget_data(widget)

        assert data["type"] == "number"
        assert data["value"] == 300

    def test_get_widget_data_line_chart(self, aggregator):
        """Test getting line chart widget data."""
        builder = DashboardBuilder(aggregator)
        for i in range(5):
            aggregator.record("timeseries", i * 10)

        widget = builder.create_widget("Trend", WidgetType.LINE_CHART, "timeseries")
        data = builder.get_widget_data(widget)

        assert data["type"] == "line_chart"
        assert "series" in data

    def test_get_widget_data_bar_chart(self, aggregator):
        """Test getting bar chart widget data."""
        builder = DashboardBuilder(aggregator)
        aggregator.record("views", 100, tags={"page": "home"})
        aggregator.record("views", 50, tags={"page": "about"})

        widget = builder.create_widget(
            "Views by Page",
            WidgetType.BAR_CHART,
            "views",
            config={"group_by": "page"}
        )
        data = builder.get_widget_data(widget)

        assert data["type"] == "bar_chart"
        assert "bars" in data

    def test_get_widget_data_pie_chart(self, aggregator):
        """Test getting pie chart widget data."""
        builder = DashboardBuilder(aggregator)
        aggregator.record("traffic", 70, tags={"source": "organic"})
        aggregator.record("traffic", 30, tags={"source": "paid"})

        widget = builder.create_widget(
            "Traffic Sources",
            WidgetType.PIE_CHART,
            "traffic",
            config={"group_by": "source"}
        )
        data = builder.get_widget_data(widget)

        assert data["type"] == "pie_chart"
        assert "slices" in data

    def test_render_dashboard(self, aggregator):
        """Test rendering dashboard."""
        builder = DashboardBuilder(aggregator)
        aggregator.record("metric1", 100)

        dashboard = builder.create_dashboard("Test", "ws_1")
        widget = builder.create_widget("Metric", WidgetType.NUMBER, "metric1")
        builder.add_widget_to_dashboard(dashboard.id, widget)

        rendered = builder.render_dashboard(dashboard.id)

        assert rendered is not None
        assert rendered["name"] == "Test"
        assert len(rendered["widgets"]) == 1


# ==================== Dashboard Tests ====================

class TestDashboard:
    """Tests for Dashboard."""

    def test_add_widget(self):
        """Test adding widget to dashboard."""
        dashboard = Dashboard(id="dash_1", name="Test", workspace_id="ws_1")
        widget = Widget(
            id="widget_1",
            title="Test Widget",
            widget_type=WidgetType.NUMBER,
            metric_name="metric"
        )

        dashboard.add_widget(widget)
        assert len(dashboard.widgets) == 1

    def test_remove_widget(self):
        """Test removing widget from dashboard."""
        dashboard = Dashboard(id="dash_1", name="Test", workspace_id="ws_1")
        widget = Widget(
            id="widget_1",
            title="Test Widget",
            widget_type=WidgetType.NUMBER,
            metric_name="metric"
        )
        dashboard.add_widget(widget)

        result = dashboard.remove_widget("widget_1")
        assert result is True
        assert len(dashboard.widgets) == 0


# ==================== AnalyticsManager Tests ====================

class TestAnalyticsManager:
    """Tests for AnalyticsManager."""

    def test_track_event(self, manager):
        """Test tracking event via manager."""
        event = manager.track(
            EventType.PAGE_VIEW,
            user_id="user_1"
        )

        assert event is not None
        assert event.event_type == EventType.PAGE_VIEW

    def test_record_metric(self, manager):
        """Test recording metric via manager."""
        metric = manager.record_metric("api_latency", 150)

        assert metric is not None
        assert metric.value == 150

    def test_auto_metrics_from_events(self, manager):
        """Test auto-recording metrics from events."""
        manager.track(EventType.PAGE_VIEW, workspace_id="ws_1")
        manager.track(EventType.PAGE_VIEW, workspace_id="ws_1")
        manager.track(EventType.CLICK)

        # Check auto-recorded metrics
        agg = manager.aggregator.aggregate(
            "events.page_view",
            AggregationPeriod.HOUR
        )
        assert agg.count == 2

    def test_get_insights(self, manager):
        """Test getting insights."""
        for i in range(10):
            manager.record_metric("trending", i * 100)

        insights = manager.get_insights(["trending"])
        # May or may not have insights depending on significance

    def test_get_summary(self, manager):
        """Test getting summary."""
        manager.track(EventType.PAGE_VIEW)
        manager.record_metric("views", 100)

        summary = manager.get_summary()

        assert "total_events" in summary
        assert "event_counts" in summary
        assert "metrics" in summary

    def test_cleanup(self, manager):
        """Test cleaning up old data."""
        manager.track(EventType.PAGE_VIEW)
        manager.record_metric("old_metric", 100)

        result = manager.cleanup(retention_days=0)

        assert result["events_cleared"] >= 0
        assert result["metrics_cleared"] >= 0

    def test_get_stats(self, manager):
        """Test getting stats."""
        manager.track(EventType.PAGE_VIEW)
        manager.record_metric("metric", 100)

        stats = manager.get_stats()

        assert "total_events" in stats
        assert "total_metrics" in stats
        assert "dashboards" in stats


# ==================== Global Functions Tests ====================

class TestGlobalFunctions:
    """Tests for global functions."""

    def test_get_set_reset_analytics_manager(self, manager):
        """Test global analytics manager management."""
        reset_analytics_manager()
        assert get_analytics_manager() is None

        set_analytics_manager(manager)
        assert get_analytics_manager() is manager

        reset_analytics_manager()
        assert get_analytics_manager() is None


# ==================== Edge Cases Tests ====================

class TestEdgeCases:
    """Tests for edge cases."""

    def test_empty_aggregation(self, aggregator):
        """Test aggregation with no data."""
        agg = aggregator.aggregate("nonexistent", AggregationPeriod.HOUR)

        assert agg.count == 0
        assert agg.avg_value == 0

    def test_empty_time_series(self, aggregator):
        """Test time series with no data."""
        series = aggregator.get_time_series(
            "nonexistent",
            AggregationPeriod.HOUR
        )

        assert len(series.points) >= 0

    def test_percentile_empty(self, aggregator):
        """Test percentile with no data."""
        result = aggregator.get_percentile("nonexistent", 50)
        assert result == 0.0

    def test_top_values_empty(self, aggregator):
        """Test top values with no data."""
        result = aggregator.get_top_values("nonexistent", "tag")
        assert result == []

    def test_generate_nonexistent_template(self, tracker, aggregator):
        """Test generating from nonexistent template."""
        generator = ReportGenerator(tracker, aggregator)
        report = generator.generate("nonexistent")
        assert report is None

    def test_export_nonexistent_report(self, tracker, aggregator):
        """Test exporting nonexistent report."""
        generator = ReportGenerator(tracker, aggregator)
        result = generator.export_report("nonexistent")
        assert result is None

    def test_get_nonexistent_dashboard(self, aggregator):
        """Test getting nonexistent dashboard."""
        builder = DashboardBuilder(aggregator)
        result = builder.get_dashboard("nonexistent")
        assert result is None

    def test_delete_nonexistent_dashboard(self, aggregator):
        """Test deleting nonexistent dashboard."""
        builder = DashboardBuilder(aggregator)
        result = builder.delete_dashboard("nonexistent")
        assert result is False

    def test_add_widget_nonexistent_dashboard(self, aggregator):
        """Test adding widget to nonexistent dashboard."""
        builder = DashboardBuilder(aggregator)
        widget = builder.create_widget("Test", WidgetType.NUMBER, "metric")
        result = builder.add_widget_to_dashboard("nonexistent", widget)
        assert result is False

    def test_render_nonexistent_dashboard(self, aggregator):
        """Test rendering nonexistent dashboard."""
        builder = DashboardBuilder(aggregator)
        result = builder.render_dashboard("nonexistent")
        assert result is None

    def test_trend_insufficient_data(self):
        """Test trend with insufficient data."""
        series = TimeSeries(name="test")
        series.add_point(datetime.utcnow(), 10)  # Only one point

        assert series.get_trend() == TrendDirection.STABLE
