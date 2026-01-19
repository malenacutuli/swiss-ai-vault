import pytest
from app.scheduler.task_scheduler import TaskScheduler, ScheduledTask, ScheduleStatus
from app.analysis.data_analyzer import DataAnalyzer
from app.browser.session_manager import CloudBrowserSessionManager, SessionStatus
from app.mcp.protocol_handler import MCPProtocolHandler

@pytest.fixture
def scheduler():
    async def dummy_executor(config):
        pass
    return TaskScheduler(dummy_executor)

@pytest.fixture
def analyzer():
    return DataAnalyzer()

@pytest.fixture
def browser_manager():
    return CloudBrowserSessionManager()

@pytest.fixture
def mcp_handler():
    return MCPProtocolHandler()

# Scheduled Task Tests
def test_create_scheduled_task(scheduler):
    """Test creating scheduled task"""
    task = scheduler.create_task(
        task_id="test-task",
        name="Test Task",
        cron_expression="0 0 * * *",
        task_config={"action": "test"}
    )

    assert task.task_id == "test-task"
    assert task.status == ScheduleStatus.ACTIVE
    assert task.name == "Test Task"
    assert task.cron_expression == "0 0 * * *"

def test_get_scheduled_task(scheduler):
    """Test getting scheduled task"""
    task = scheduler.create_task(
        task_id="test-task",
        name="Test Task",
        cron_expression="0 0 * * *",
        task_config={"action": "test"}
    )

    retrieved = scheduler.get_task("test-task")
    assert retrieved is not None
    assert retrieved.task_id == "test-task"

def test_pause_scheduled_task(scheduler):
    """Test pausing scheduled task"""
    task = scheduler.create_task(
        task_id="test-task",
        name="Test Task",
        cron_expression="0 0 * * *",
        task_config={"action": "test"}
    )

    result = scheduler.pause_task("test-task")
    assert result is True
    assert task.status == ScheduleStatus.PAUSED

def test_resume_scheduled_task(scheduler):
    """Test resuming scheduled task"""
    task = scheduler.create_task(
        task_id="test-task",
        name="Test Task",
        cron_expression="0 0 * * *",
        task_config={"action": "test"}
    )

    scheduler.pause_task("test-task")
    result = scheduler.resume_task("test-task")
    assert result is True
    assert task.status == ScheduleStatus.ACTIVE

def test_list_scheduled_tasks(scheduler):
    """Test listing scheduled tasks"""
    scheduler.create_task(
        task_id="test-task-1",
        name="Test Task 1",
        cron_expression="0 0 * * *",
        task_config={"action": "test1"}
    )
    scheduler.create_task(
        task_id="test-task-2",
        name="Test Task 2",
        cron_expression="0 12 * * *",
        task_config={"action": "test2"}
    )

    tasks = scheduler.list_tasks()
    assert len(tasks) == 2

def test_scheduled_task_to_dict(scheduler):
    """Test scheduled task serialization"""
    task = scheduler.create_task(
        task_id="test-task",
        name="Test Task",
        cron_expression="0 0 * * *",
        task_config={"action": "test"}
    )

    task_dict = task.to_dict()
    assert task_dict["task_id"] == "test-task"
    assert task_dict["name"] == "Test Task"
    assert task_dict["status"] == "active"

# Data Analysis Tests
def test_analyze_dataset(analyzer):
    """Test data analysis"""
    data = [
        {"name": "Alice", "age": 30, "score": 85},
        {"name": "Bob", "age": 25, "score": 90},
        {"name": "Charlie", "age": 35, "score": 80}
    ]

    analysis = analyzer.analyze_dataset(data)

    assert analysis["record_count"] == 3
    assert "fields" in analysis
    assert "statistics" in analysis
    assert "insights" in analysis

def test_analyze_empty_dataset(analyzer):
    """Test analyzing empty dataset"""
    analysis = analyzer.analyze_dataset([])

    assert "error" in analysis
    assert analysis["error"] == "No data provided"

def test_analyze_fields(analyzer):
    """Test field analysis"""
    data = [
        {"name": "Alice", "age": 30},
        {"name": "Bob", "age": 25}
    ]

    analysis = analyzer.analyze_dataset(data)
    fields = analysis["fields"]

    assert "name" in fields
    assert "age" in fields
    assert fields["name"]["count"] == 2
    assert fields["age"]["count"] == 2

def test_calculate_statistics(analyzer):
    """Test statistics calculation"""
    data = [
        {"score": 85},
        {"score": 90},
        {"score": 80}
    ]

    analysis = analyzer.analyze_dataset(data)
    stats = analysis["statistics"]

    assert "score" in stats
    assert stats["score"]["min"] == 80
    assert stats["score"]["max"] == 90
    assert stats["score"]["avg"] == 85

def test_generate_chart_data(analyzer):
    """Test chart data generation"""
    data = [
        {"month": "Jan", "sales": 100},
        {"month": "Feb", "sales": 150},
        {"month": "Mar", "sales": 120}
    ]

    chart_data = analyzer.generate_chart_data(data, "month", "sales")

    assert chart_data["type"] == "bar"
    assert len(chart_data["labels"]) == 3
    assert len(chart_data["datasets"][0]["data"]) == 3

def test_generate_insights(analyzer):
    """Test insight generation"""
    data = [
        {"name": "Alice", "age": 30, "score": 85},
        {"name": "Bob", "age": 25, "score": 90}
    ]

    analysis = analyzer.analyze_dataset(data)
    insights = analysis["insights"]

    assert len(insights) > 0
    assert "Dataset contains 2 records" in insights

# Browser Session Tests
def test_create_browser_session(browser_manager):
    """Test creating browser session"""
    session = browser_manager.create_session()

    assert session.session_id is not None
    assert session.status == SessionStatus.ACTIVE
    assert session.current_url is None
    assert len(session.history) == 0

def test_get_browser_session(browser_manager):
    """Test getting browser session"""
    session = browser_manager.create_session()

    retrieved = browser_manager.get_session(session.session_id)
    assert retrieved is not None
    assert retrieved.session_id == session.session_id

def test_navigate_browser(browser_manager):
    """Test browser navigation"""
    session = browser_manager.create_session()

    result = browser_manager.navigate(session.session_id, "https://example.com")

    assert result is True
    assert session.current_url == "https://example.com"
    assert len(session.history) == 1

def test_navigate_nonexistent_session(browser_manager):
    """Test navigating nonexistent session"""
    result = browser_manager.navigate("nonexistent", "https://example.com")
    assert result is False

def test_close_browser_session(browser_manager):
    """Test closing browser session"""
    session = browser_manager.create_session()

    result = browser_manager.close_session(session.session_id)

    assert result is True
    assert session.status == SessionStatus.CLOSED

def test_list_browser_sessions(browser_manager):
    """Test listing browser sessions"""
    browser_manager.create_session()
    browser_manager.create_session()

    sessions = browser_manager.list_sessions()
    assert len(sessions) == 2

def test_browser_session_to_dict(browser_manager):
    """Test browser session serialization"""
    session = browser_manager.create_session()

    session_dict = session.to_dict()
    assert session_dict["session_id"] == session.session_id
    assert session_dict["status"] == "active"
    assert "created_at" in session_dict

# MCP Protocol Tests
@pytest.mark.asyncio
async def test_mcp_initialize(mcp_handler):
    """Test MCP initialization"""
    response = await mcp_handler.handle_request({
        "method": "initialize",
        "params": {}
    })

    assert "protocol_version" in response
    assert "capabilities" in response
    assert "server_info" in response
    assert response["server_info"]["name"] == "SwissBrain.ai"

@pytest.mark.asyncio
async def test_mcp_tools_list(mcp_handler):
    """Test MCP tools list"""
    response = await mcp_handler.handle_request({
        "method": "tools/list",
        "params": {}
    })

    assert "tools" in response
    assert len(response["tools"]) > 0
    assert any(tool["name"] == "shell" for tool in response["tools"])

@pytest.mark.asyncio
async def test_mcp_tools_call(mcp_handler):
    """Test MCP tools call"""
    response = await mcp_handler.handle_request({
        "method": "tools/call",
        "params": {
            "name": "shell",
            "arguments": {"command": "ls"}
        }
    })

    assert "result" in response

@pytest.mark.asyncio
async def test_mcp_resources_list(mcp_handler):
    """Test MCP resources list"""
    response = await mcp_handler.handle_request({
        "method": "resources/list",
        "params": {}
    })

    assert "resources" in response
    assert len(response["resources"]) > 0

@pytest.mark.asyncio
async def test_mcp_resources_read(mcp_handler):
    """Test MCP resources read"""
    response = await mcp_handler.handle_request({
        "method": "resources/read",
        "params": {
            "uri": "workspace://"
        }
    })

    assert "contents" in response

@pytest.mark.asyncio
async def test_mcp_unknown_method(mcp_handler):
    """Test MCP unknown method"""
    response = await mcp_handler.handle_request({
        "method": "unknown/method",
        "params": {}
    })

    assert "error" in response
