"""
Tests for Task Management Module

Tests cover:
- Task creation and lifecycle
- Task assignments and ownership
- Task lists and boards
- Task dependencies
- Comments and checklists
- Time tracking
- Task manager operations
"""

import pytest
from datetime import datetime, timedelta
from app.collaboration.tasks import (
    TaskManager,
    TaskRegistry,
    Task,
    TaskStatus,
    TaskPriority,
    TaskType,
    TaskList,
    TaskBoard,
    BoardColumn,
    BoardViewType,
    TaskComment,
    TaskDependency,
    DependencyType,
    TaskAssignment,
    ChecklistItem,
    TimeEntry,
    RecurrenceRule,
    RecurrencePattern,
    SortField,
    SortOrder,
    get_task_manager,
    set_task_manager,
    reset_task_manager,
)


# ==================== ChecklistItem Tests ====================

class TestChecklistItem:
    """Tests for ChecklistItem."""

    def test_create_checklist_item(self):
        """Test creating a checklist item."""
        item = ChecklistItem(
            id="check_1",
            text="Review code"
        )

        assert item.id == "check_1"
        assert item.text == "Review code"
        assert not item.is_completed

    def test_complete_item(self):
        """Test completing a checklist item."""
        item = ChecklistItem(id="check_1", text="Test")

        item.complete("user1")

        assert item.is_completed
        assert item.completed_by == "user1"
        assert item.completed_at is not None

    def test_uncomplete_item(self):
        """Test uncompleting a checklist item."""
        item = ChecklistItem(id="check_1", text="Test")
        item.complete("user1")

        item.uncomplete()

        assert not item.is_completed
        assert item.completed_by is None
        assert item.completed_at is None


# ==================== TaskComment Tests ====================

class TestTaskComment:
    """Tests for TaskComment."""

    def test_create_comment(self):
        """Test creating a comment."""
        comment = TaskComment(
            id="comment_1",
            task_id="task_1",
            author_id="user1",
            content="This looks good!"
        )

        assert comment.id == "comment_1"
        assert comment.content == "This looks good!"

    def test_extract_mentions(self):
        """Test mention extraction."""
        mentions = TaskComment._extract_mentions("Hey @john and @jane, please review")

        assert "john" in mentions
        assert "jane" in mentions

    def test_edit_comment(self):
        """Test editing a comment."""
        comment = TaskComment(
            id="comment_1",
            task_id="task_1",
            author_id="user1",
            content="Original"
        )

        comment.edit("Updated content @bob")

        assert comment.content == "Updated content @bob"
        assert comment.is_edited
        assert "bob" in comment.mentions


# ==================== RecurrenceRule Tests ====================

class TestRecurrenceRule:
    """Tests for RecurrenceRule."""

    def test_daily_recurrence(self):
        """Test daily recurrence."""
        rule = RecurrenceRule(pattern=RecurrencePattern.DAILY, interval=1)
        start = datetime(2024, 1, 1, 10, 0)

        next_date = rule.get_next_due_date(start)

        assert next_date == datetime(2024, 1, 2, 10, 0)

    def test_weekly_recurrence(self):
        """Test weekly recurrence."""
        rule = RecurrenceRule(pattern=RecurrencePattern.WEEKLY, interval=1)
        start = datetime(2024, 1, 1, 10, 0)

        next_date = rule.get_next_due_date(start)

        assert next_date == datetime(2024, 1, 8, 10, 0)

    def test_monthly_recurrence(self):
        """Test monthly recurrence."""
        rule = RecurrenceRule(pattern=RecurrencePattern.MONTHLY, interval=1)
        start = datetime(2024, 1, 15, 10, 0)

        next_date = rule.get_next_due_date(start)

        assert next_date.month == 2
        assert next_date.day == 15

    def test_recurrence_with_end_date(self):
        """Test recurrence with end date."""
        rule = RecurrenceRule(
            pattern=RecurrencePattern.DAILY,
            interval=1,
            end_date=datetime(2024, 1, 5)
        )
        start = datetime(2024, 1, 10)

        next_date = rule.get_next_due_date(start)

        assert next_date is None

    def test_recurrence_with_max_occurrences(self):
        """Test recurrence with max occurrences."""
        rule = RecurrenceRule(
            pattern=RecurrencePattern.DAILY,
            interval=1,
            max_occurrences=5,
            occurrences_created=5
        )
        start = datetime(2024, 1, 1)

        next_date = rule.get_next_due_date(start)

        assert next_date is None


# ==================== Task Tests ====================

class TestTask:
    """Tests for Task data class."""

    def test_create_task(self):
        """Test creating a task."""
        task = Task(
            id="task_1",
            title="Implement feature",
            task_type=TaskType.FEATURE
        )

        assert task.id == "task_1"
        assert task.title == "Implement feature"
        assert task.status == TaskStatus.TODO
        assert task.priority == TaskPriority.MEDIUM

    def test_assign_user(self):
        """Test assigning a user."""
        task = Task(id="task_1", title="Test")

        task.assign("user1")
        task.assign("user2")

        assert "user1" in task.assignee_ids
        assert "user2" in task.assignee_ids

    def test_unassign_user(self):
        """Test unassigning a user."""
        task = Task(id="task_1", title="Test", assignee_ids={"user1", "user2"})

        result = task.unassign("user1")

        assert result is True
        assert "user1" not in task.assignee_ids

    def test_add_watcher(self):
        """Test adding a watcher."""
        task = Task(id="task_1", title="Test")

        task.add_watcher("user1")

        assert "user1" in task.watcher_ids

    def test_remove_watcher(self):
        """Test removing a watcher."""
        task = Task(id="task_1", title="Test", watcher_ids={"user1"})

        result = task.remove_watcher("user1")

        assert result is True
        assert "user1" not in task.watcher_ids

    def test_add_tag(self):
        """Test adding a tag."""
        task = Task(id="task_1", title="Test")

        task.add_tag("Important")
        task.add_tag("URGENT")

        assert "important" in task.tags
        assert "urgent" in task.tags

    def test_remove_tag(self):
        """Test removing a tag."""
        task = Task(id="task_1", title="Test", tags={"bug", "critical"})

        result = task.remove_tag("bug")

        assert result is True
        assert "bug" not in task.tags

    def test_set_status_completed(self):
        """Test setting status to completed."""
        task = Task(id="task_1", title="Test")

        task.set_status(TaskStatus.COMPLETED)

        assert task.status == TaskStatus.COMPLETED
        assert task.completed_at is not None

    def test_set_status_from_completed(self):
        """Test changing from completed status."""
        task = Task(id="task_1", title="Test", status=TaskStatus.COMPLETED)
        task.completed_at = datetime.utcnow()

        task.set_status(TaskStatus.IN_PROGRESS)

        assert task.status == TaskStatus.IN_PROGRESS
        assert task.completed_at is None

    def test_checklist_progress(self):
        """Test checklist progress calculation."""
        task = Task(id="task_1", title="Test")
        task.checklist = [
            ChecklistItem(id="1", text="Item 1", is_completed=True),
            ChecklistItem(id="2", text="Item 2", is_completed=False),
            ChecklistItem(id="3", text="Item 3", is_completed=True),
            ChecklistItem(id="4", text="Item 4", is_completed=False),
        ]

        assert task.checklist_progress == 0.5

    def test_checklist_progress_empty(self):
        """Test checklist progress with no items."""
        task = Task(id="task_1", title="Test")

        assert task.checklist_progress == 1.0

    def test_is_overdue(self):
        """Test overdue check."""
        # Not overdue
        task = Task(
            id="task_1",
            title="Test",
            due_date=datetime.utcnow() + timedelta(days=1)
        )
        assert not task.is_overdue

        # Overdue
        task.due_date = datetime.utcnow() - timedelta(days=1)
        assert task.is_overdue

        # Completed tasks are not overdue
        task.status = TaskStatus.COMPLETED
        assert not task.is_overdue

    def test_days_until_due(self):
        """Test days until due calculation."""
        task = Task(
            id="task_1",
            title="Test",
            due_date=datetime.utcnow() + timedelta(days=5)
        )

        days = task.days_until_due
        assert days is not None
        assert 4 <= days <= 5

    def test_to_dict(self):
        """Test task serialization."""
        task = Task(
            id="task_1",
            title="Test",
            task_type=TaskType.BUG,
            status=TaskStatus.IN_PROGRESS,
            priority=TaskPriority.HIGH,
            tags={"bug"}
        )

        d = task.to_dict()
        assert d["id"] == "task_1"
        assert d["type"] == "bug"
        assert d["status"] == "in_progress"


# ==================== TaskList Tests ====================

class TestTaskList:
    """Tests for TaskList."""

    def test_create_list(self):
        """Test creating a task list."""
        task_list = TaskList(
            id="list_1",
            name="Sprint 1"
        )

        assert task_list.id == "list_1"
        assert task_list.name == "Sprint 1"

    def test_add_task(self):
        """Test adding a task to list."""
        task_list = TaskList(id="list_1", name="Test")

        task_list.add_task("task_1")
        task_list.add_task("task_2")

        assert task_list.task_ids == ["task_1", "task_2"]
        assert task_list.task_count == 2

    def test_add_task_at_position(self):
        """Test adding task at specific position."""
        task_list = TaskList(id="list_1", name="Test", task_ids=["task_1", "task_3"])

        task_list.add_task("task_2", position=1)

        assert task_list.task_ids == ["task_1", "task_2", "task_3"]

    def test_remove_task(self):
        """Test removing a task from list."""
        task_list = TaskList(id="list_1", name="Test", task_ids=["task_1", "task_2"])

        result = task_list.remove_task("task_1")

        assert result is True
        assert "task_1" not in task_list.task_ids

    def test_reorder_task(self):
        """Test reordering a task."""
        task_list = TaskList(id="list_1", name="Test", task_ids=["task_1", "task_2", "task_3"])

        result = task_list.reorder_task("task_3", 0)

        assert result is True
        assert task_list.task_ids[0] == "task_3"


# ==================== TaskBoard Tests ====================

class TestTaskBoard:
    """Tests for TaskBoard."""

    def test_create_board(self):
        """Test creating a board."""
        board = TaskBoard(
            id="board_1",
            name="Project Board"
        )

        assert board.id == "board_1"
        assert board.view_type == BoardViewType.KANBAN

    def test_add_column(self):
        """Test adding a column."""
        board = TaskBoard(id="board_1", name="Test")
        column = BoardColumn(
            id="col_1",
            name="To Do",
            status=TaskStatus.TODO,
            order=0
        )

        board.add_column(column)

        assert len(board.columns) == 1
        assert board.columns[0].name == "To Do"

    def test_remove_column(self):
        """Test removing a column."""
        board = TaskBoard(id="board_1", name="Test")
        column = BoardColumn(id="col_1", name="To Do", status=TaskStatus.TODO)
        board.add_column(column)

        result = board.remove_column("col_1")

        assert result is True
        assert len(board.columns) == 0

    def test_get_column(self):
        """Test getting a column."""
        board = TaskBoard(id="board_1", name="Test")
        column = BoardColumn(id="col_1", name="To Do", status=TaskStatus.TODO)
        board.add_column(column)

        fetched = board.get_column("col_1")

        assert fetched == column

    def test_get_column_by_status(self):
        """Test getting a column by status."""
        board = TaskBoard(id="board_1", name="Test")
        board.add_column(BoardColumn(id="col_1", name="To Do", status=TaskStatus.TODO))
        board.add_column(BoardColumn(id="col_2", name="Done", status=TaskStatus.COMPLETED))

        column = board.get_column_by_status(TaskStatus.COMPLETED)

        assert column.id == "col_2"

    def test_move_task(self):
        """Test moving a task between columns."""
        board = TaskBoard(id="board_1", name="Test")
        col1 = BoardColumn(id="col_1", name="To Do", status=TaskStatus.TODO, task_ids=["task_1"])
        col2 = BoardColumn(id="col_2", name="Done", status=TaskStatus.COMPLETED)
        board.add_column(col1)
        board.add_column(col2)

        result = board.move_task("task_1", "col_2")

        assert result is True
        assert "task_1" not in col1.task_ids
        assert "task_1" in col2.task_ids


# ==================== BoardColumn Tests ====================

class TestBoardColumn:
    """Tests for BoardColumn."""

    def test_wip_limit(self):
        """Test WIP limit check."""
        column = BoardColumn(
            id="col_1",
            name="In Progress",
            status=TaskStatus.IN_PROGRESS,
            wip_limit=3,
            task_ids=["t1", "t2"]
        )

        assert not column.is_at_wip_limit

        column.task_ids.append("t3")
        assert column.is_at_wip_limit


# ==================== TaskRegistry Tests ====================

class TestTaskRegistry:
    """Tests for TaskRegistry."""

    def test_create_task(self):
        """Test creating a task."""
        registry = TaskRegistry()

        task = registry.create_task(
            title="Test Task",
            workspace_id="ws1",
            creator_id="user1"
        )

        assert task.id.startswith("task_")
        assert task.title == "Test Task"
        assert task.creator_id == "user1"

    def test_get_task(self):
        """Test getting a task."""
        registry = TaskRegistry()

        task = registry.create_task(title="Test")

        fetched = registry.get_task(task.id)
        assert fetched == task

    def test_update_task(self):
        """Test updating a task."""
        registry = TaskRegistry()

        task = registry.create_task(title="Test")
        task.title = "Updated"
        task.add_tag("important")

        result = registry.update_task(task)
        assert result is True

    def test_delete_task_soft(self):
        """Test soft deleting a task."""
        registry = TaskRegistry()

        task = registry.create_task(title="Test")

        result = registry.delete_task(task.id, soft_delete=True)

        assert result is True
        assert task.status == TaskStatus.ARCHIVED

    def test_delete_task_hard(self):
        """Test hard deleting a task."""
        registry = TaskRegistry()

        task = registry.create_task(title="Test")

        result = registry.delete_task(task.id, soft_delete=False)

        assert result is True
        assert registry.get_task(task.id) is None

    def test_list_tasks(self):
        """Test listing tasks."""
        registry = TaskRegistry()

        registry.create_task(title="Task 1", workspace_id="ws1")
        registry.create_task(title="Task 2", workspace_id="ws1")
        registry.create_task(title="Task 3", workspace_id="ws2")

        tasks = registry.list_tasks()
        assert len(tasks) == 3

        tasks = registry.list_tasks(workspace_id="ws1")
        assert len(tasks) == 2

    def test_list_tasks_by_status(self):
        """Test listing tasks by status."""
        registry = TaskRegistry()

        t1 = registry.create_task(title="T1")
        t1.status = TaskStatus.TODO

        t2 = registry.create_task(title="T2")
        t2.status = TaskStatus.COMPLETED

        tasks = registry.list_tasks(status=TaskStatus.TODO)
        assert len(tasks) == 1

    def test_list_tasks_by_priority(self):
        """Test listing tasks by priority."""
        registry = TaskRegistry()

        t1 = registry.create_task(title="T1")
        t1.priority = TaskPriority.HIGH

        t2 = registry.create_task(title="T2")
        t2.priority = TaskPriority.LOW

        tasks = registry.list_tasks(priority=TaskPriority.HIGH)
        assert len(tasks) == 1

    def test_list_tasks_by_assignee(self):
        """Test listing tasks by assignee."""
        registry = TaskRegistry()

        t1 = registry.create_task(title="T1")
        t1.assign("user1")
        registry.update_task(t1)

        t2 = registry.create_task(title="T2")
        t2.assign("user2")
        registry.update_task(t2)

        tasks = registry.list_tasks(assignee_id="user1")
        assert len(tasks) == 1

    def test_list_tasks_sorting(self):
        """Test listing tasks with sorting."""
        registry = TaskRegistry()

        t1 = registry.create_task(title="B Task")
        t1.priority = TaskPriority.LOW

        t2 = registry.create_task(title="A Task")
        t2.priority = TaskPriority.HIGH

        # Sort by title ascending
        tasks = registry.list_tasks(sort_field=SortField.TITLE, sort_order=SortOrder.ASC)
        assert tasks[0].title == "A Task"

        # Sort by priority
        tasks = registry.list_tasks(sort_field=SortField.PRIORITY, sort_order=SortOrder.ASC)
        assert tasks[0].priority == TaskPriority.HIGH

    def test_list_tasks_pagination(self):
        """Test listing tasks with pagination."""
        registry = TaskRegistry()

        for i in range(10):
            registry.create_task(title=f"Task {i}")

        tasks = registry.list_tasks(limit=3, offset=0)
        assert len(tasks) == 3

        tasks = registry.list_tasks(limit=3, offset=3)
        assert len(tasks) == 3

    def test_search_tasks(self):
        """Test searching tasks."""
        registry = TaskRegistry()

        registry.create_task(title="Fix login bug", description="Authentication issue")
        registry.create_task(title="Add feature", description="New functionality")

        results = registry.search_tasks("login")
        assert len(results) == 1

        results = registry.search_tasks("authentication")
        assert len(results) == 1

    def test_get_subtasks(self):
        """Test getting subtasks."""
        registry = TaskRegistry()

        parent = registry.create_task(title="Parent")
        child1 = registry.create_task(title="Child 1", parent_id=parent.id)
        child2 = registry.create_task(title="Child 2", parent_id=parent.id)

        subtasks = registry.get_subtasks(parent.id)
        assert len(subtasks) == 2

    def test_get_user_tasks(self):
        """Test getting user's tasks."""
        registry = TaskRegistry()

        t1 = registry.create_task(title="T1")
        t1.assign("user1")
        registry.update_task(t1)

        t2 = registry.create_task(title="T2")
        t2.assign("user1")
        registry.update_task(t2)

        tasks = registry.get_user_tasks("user1")
        assert len(tasks) == 2

    def test_get_overdue_tasks(self):
        """Test getting overdue tasks."""
        registry = TaskRegistry()

        t1 = registry.create_task(title="T1")
        t1.due_date = datetime.utcnow() - timedelta(days=1)

        t2 = registry.create_task(title="T2")
        t2.due_date = datetime.utcnow() + timedelta(days=1)

        overdue = registry.get_overdue_tasks()
        assert len(overdue) == 1


# ==================== TaskList Registry Tests ====================

class TestTaskListRegistry:
    """Tests for task list management in registry."""

    def test_create_list(self):
        """Test creating a list."""
        registry = TaskRegistry()

        task_list = registry.create_list(
            name="Sprint 1",
            workspace_id="ws1"
        )

        assert task_list.id.startswith("list_")
        assert task_list.name == "Sprint 1"

    def test_get_list(self):
        """Test getting a list."""
        registry = TaskRegistry()

        task_list = registry.create_list(name="Test")

        fetched = registry.get_list(task_list.id)
        assert fetched == task_list

    def test_delete_list(self):
        """Test deleting a list."""
        registry = TaskRegistry()

        task_list = registry.create_list(name="Test")

        result = registry.delete_list(task_list.id)
        assert result is True
        assert registry.get_list(task_list.id) is None

    def test_list_lists(self):
        """Test listing lists."""
        registry = TaskRegistry()

        registry.create_list(name="L1", workspace_id="ws1")
        registry.create_list(name="L2", workspace_id="ws1")
        registry.create_list(name="L3", workspace_id="ws2")

        lists = registry.list_lists()
        assert len(lists) == 3

        lists = registry.list_lists(workspace_id="ws1")
        assert len(lists) == 2

    def test_add_task_to_list(self):
        """Test adding task to list."""
        registry = TaskRegistry()

        task = registry.create_task(title="Test")
        task_list = registry.create_list(name="Sprint")

        result = registry.add_task_to_list(task.id, task_list.id)

        assert result is True
        assert task.id in task_list.task_ids
        assert task.list_id == task_list.id

    def test_remove_task_from_list(self):
        """Test removing task from list."""
        registry = TaskRegistry()

        task = registry.create_task(title="Test")
        task_list = registry.create_list(name="Sprint")
        registry.add_task_to_list(task.id, task_list.id)

        result = registry.remove_task_from_list(task.id, task_list.id)

        assert result is True
        assert task.id not in task_list.task_ids


# ==================== Board Registry Tests ====================

class TestBoardRegistry:
    """Tests for board management in registry."""

    def test_create_board(self):
        """Test creating a board."""
        registry = TaskRegistry()

        board = registry.create_board(
            name="Project Board",
            workspace_id="ws1"
        )

        assert board.id.startswith("board_")
        assert board.name == "Project Board"

    def test_get_board(self):
        """Test getting a board."""
        registry = TaskRegistry()

        board = registry.create_board(name="Test")

        fetched = registry.get_board(board.id)
        assert fetched == board

    def test_delete_board(self):
        """Test deleting a board."""
        registry = TaskRegistry()

        board = registry.create_board(name="Test")

        result = registry.delete_board(board.id)
        assert result is True

    def test_list_boards(self):
        """Test listing boards."""
        registry = TaskRegistry()

        registry.create_board(name="B1", workspace_id="ws1")
        registry.create_board(name="B2", workspace_id="ws1")
        registry.create_board(name="B3", workspace_id="ws2")

        boards = registry.list_boards()
        assert len(boards) == 3

        boards = registry.list_boards(workspace_id="ws1")
        assert len(boards) == 2


# ==================== Comment Registry Tests ====================

class TestCommentRegistry:
    """Tests for comment management in registry."""

    def test_add_comment(self):
        """Test adding a comment."""
        registry = TaskRegistry()

        task = registry.create_task(title="Test")

        comment = registry.add_comment(
            task_id=task.id,
            author_id="user1",
            content="Looks good!"
        )

        assert comment is not None
        assert comment.id.startswith("comment_")
        assert task.comment_count == 1

    def test_get_task_comments(self):
        """Test getting task comments."""
        registry = TaskRegistry()

        task = registry.create_task(title="Test")
        registry.add_comment(task.id, "user1", "Comment 1")
        registry.add_comment(task.id, "user2", "Comment 2")

        comments = registry.get_task_comments(task.id)
        assert len(comments) == 2

    def test_delete_comment(self):
        """Test deleting a comment."""
        registry = TaskRegistry()

        task = registry.create_task(title="Test")
        comment = registry.add_comment(task.id, "user1", "Test")

        result = registry.delete_comment(comment.id)

        assert result is True
        assert comment.is_deleted


# ==================== Dependency Registry Tests ====================

class TestDependencyRegistry:
    """Tests for dependency management in registry."""

    def test_add_dependency(self):
        """Test adding a dependency."""
        registry = TaskRegistry()

        t1 = registry.create_task(title="Task 1")
        t2 = registry.create_task(title="Task 2")

        dep = registry.add_dependency(
            source_task_id=t1.id,
            target_task_id=t2.id,
            dependency_type=DependencyType.BLOCKS
        )

        assert dep is not None
        assert dep.id.startswith("dep_")

    def test_prevent_self_dependency(self):
        """Test preventing self-dependency."""
        registry = TaskRegistry()

        task = registry.create_task(title="Test")

        dep = registry.add_dependency(
            source_task_id=task.id,
            target_task_id=task.id,
            dependency_type=DependencyType.BLOCKS
        )

        assert dep is None

    def test_get_dependencies(self):
        """Test getting dependencies."""
        registry = TaskRegistry()

        t1 = registry.create_task(title="T1")
        t2 = registry.create_task(title="T2")
        t3 = registry.create_task(title="T3")

        registry.add_dependency(t1.id, t2.id, DependencyType.BLOCKS)
        registry.add_dependency(t3.id, t1.id, DependencyType.BLOCKED_BY)

        deps = registry.get_dependencies(t1.id)
        assert len(deps) == 2

    def test_get_blocking_tasks(self):
        """Test getting blocking tasks."""
        registry = TaskRegistry()

        blocker = registry.create_task(title="Blocker")
        blocked = registry.create_task(title="Blocked")

        registry.add_dependency(blocker.id, blocked.id, DependencyType.BLOCKED_BY)

        blocking = registry.get_blocking_tasks(blocked.id)
        assert len(blocking) == 1
        assert blocking[0].id == blocker.id

    def test_remove_dependency(self):
        """Test removing a dependency."""
        registry = TaskRegistry()

        t1 = registry.create_task(title="T1")
        t2 = registry.create_task(title="T2")

        dep = registry.add_dependency(t1.id, t2.id, DependencyType.BLOCKS)

        result = registry.remove_dependency(dep.id)
        assert result is True


# ==================== Time Entry Registry Tests ====================

class TestTimeEntryRegistry:
    """Tests for time entry management in registry."""

    def test_add_time_entry(self):
        """Test adding a time entry."""
        registry = TaskRegistry()

        task = registry.create_task(title="Test")

        entry = registry.add_time_entry(
            task_id=task.id,
            user_id="user1",
            duration_minutes=60,
            description="Coding"
        )

        assert entry is not None
        assert entry.duration_minutes == 60
        assert task.actual_hours == 1.0

    def test_get_task_time_entries(self):
        """Test getting task time entries."""
        registry = TaskRegistry()

        task = registry.create_task(title="Test")
        registry.add_time_entry(task.id, "user1", 30)
        registry.add_time_entry(task.id, "user1", 60)

        entries = registry.get_task_time_entries(task.id)
        assert len(entries) == 2

    def test_get_user_time_entries(self):
        """Test getting user time entries."""
        registry = TaskRegistry()

        t1 = registry.create_task(title="T1")
        t2 = registry.create_task(title="T2")

        registry.add_time_entry(t1.id, "user1", 30)
        registry.add_time_entry(t2.id, "user1", 60)
        registry.add_time_entry(t1.id, "user2", 45)

        entries = registry.get_user_time_entries("user1")
        assert len(entries) == 2


# ==================== TaskManager Tests ====================

class TestTaskManager:
    """Tests for TaskManager."""

    def test_create_task(self):
        """Test creating a task via manager."""
        manager = TaskManager()

        task = manager.create_task(
            title="Test Task",
            task_type=TaskType.BUG,
            priority=TaskPriority.HIGH,
            assignee_ids={"user1", "user2"}
        )

        assert task.title == "Test Task"
        assert task.task_type == TaskType.BUG
        assert "user1" in task.assignee_ids

    def test_create_subtask(self):
        """Test creating a subtask."""
        manager = TaskManager()

        parent = manager.create_task(title="Parent")
        child = manager.create_task(title="Child", parent_id=parent.id)

        assert child.parent_id == parent.id
        assert parent.subtask_count == 1

    def test_update_task(self):
        """Test updating a task."""
        manager = TaskManager()

        task = manager.create_task(title="Original")

        updated = manager.update_task(
            task_id=task.id,
            title="Updated",
            priority=TaskPriority.URGENT
        )

        assert updated.title == "Updated"
        assert updated.priority == TaskPriority.URGENT

    def test_complete_task(self):
        """Test completing a task."""
        manager = TaskManager()

        task = manager.create_task(title="Test")

        completed = manager.complete_task(task.id)

        assert completed.status == TaskStatus.COMPLETED
        assert completed.completed_at is not None

    def test_complete_subtask_updates_parent(self):
        """Test completing subtask updates parent count."""
        manager = TaskManager()

        parent = manager.create_task(title="Parent")
        child = manager.create_task(title="Child", parent_id=parent.id)

        manager.complete_task(child.id)

        parent = manager.get_task(parent.id)
        assert parent.completed_subtask_count == 1

    def test_delete_task(self):
        """Test deleting a task."""
        manager = TaskManager()

        task = manager.create_task(title="Test")

        result = manager.delete_task(task.id)

        assert result is True

    def test_delete_subtask_updates_parent(self):
        """Test deleting subtask updates parent count."""
        manager = TaskManager()

        parent = manager.create_task(title="Parent")
        child = manager.create_task(title="Child", parent_id=parent.id)

        manager.delete_task(child.id, permanent=True)

        parent = manager.get_task(parent.id)
        assert parent.subtask_count == 0

    def test_assign_task(self):
        """Test assigning a task."""
        manager = TaskManager()

        task = manager.create_task(title="Test")

        result = manager.assign_task(task.id, "user1")

        assert result is True
        assert "user1" in task.assignee_ids

    def test_unassign_task(self):
        """Test unassigning a task."""
        manager = TaskManager()

        task = manager.create_task(title="Test", assignee_ids={"user1"})

        result = manager.unassign_task(task.id, "user1")

        assert result is True
        assert "user1" not in task.assignee_ids

    def test_add_checklist_item(self):
        """Test adding a checklist item."""
        manager = TaskManager()

        task = manager.create_task(title="Test")

        item = manager.add_checklist_item(task.id, "Review code")

        assert item is not None
        assert item.text == "Review code"
        assert len(task.checklist) == 1

    def test_complete_checklist_item(self):
        """Test completing a checklist item."""
        manager = TaskManager()

        task = manager.create_task(title="Test")
        item = manager.add_checklist_item(task.id, "Step 1")

        result = manager.complete_checklist_item(task.id, item.id, "user1")

        assert result is True
        assert item.is_completed

    def test_create_list(self):
        """Test creating a list."""
        manager = TaskManager()

        task_list = manager.create_list(
            name="Sprint 1",
            workspace_id="ws1"
        )

        assert task_list.name == "Sprint 1"

    def test_add_to_list(self):
        """Test adding task to list."""
        manager = TaskManager()

        task = manager.create_task(title="Test")
        task_list = manager.create_list(name="Sprint")

        result = manager.add_to_list(task.id, task_list.id)

        assert result is True
        assert task.id in task_list.task_ids

    def test_create_board_with_default_columns(self):
        """Test creating board with default columns."""
        manager = TaskManager()

        board = manager.create_board(
            name="Project Board",
            default_columns=True
        )

        assert len(board.columns) == 4
        column_names = [c.name for c in board.columns]
        assert "To Do" in column_names
        assert "Done" in column_names

    def test_move_task_on_board(self):
        """Test moving task on board."""
        manager = TaskManager()

        task = manager.create_task(title="Test")
        board = manager.create_board(name="Board", default_columns=True)
        manager.add_task_to_board(task.id, board.id)

        # Find the "Done" column
        done_column = board.get_column_by_status(TaskStatus.COMPLETED)

        result = manager.move_task_on_board(board.id, task.id, done_column.id)

        assert result is True
        assert task.status == TaskStatus.COMPLETED

    def test_add_comment(self):
        """Test adding a comment."""
        manager = TaskManager()

        task = manager.create_task(title="Test")

        comment = manager.add_comment(task.id, "user1", "Great work!")

        assert comment is not None
        assert comment.content == "Great work!"

    def test_add_dependency(self):
        """Test adding a dependency."""
        manager = TaskManager()

        t1 = manager.create_task(title="T1")
        t2 = manager.create_task(title="T2")

        dep = manager.add_dependency(t1.id, t2.id, DependencyType.BLOCKS)

        assert dep is not None

    def test_log_time(self):
        """Test logging time."""
        manager = TaskManager()

        task = manager.create_task(title="Test")

        entry = manager.log_time(task.id, "user1", 120, "Coding session")

        assert entry is not None
        assert task.actual_hours == 2.0

    def test_get_stats(self):
        """Test getting statistics."""
        manager = TaskManager()

        t1 = manager.create_task(title="T1", task_type=TaskType.BUG, priority=TaskPriority.HIGH)
        t2 = manager.create_task(title="T2", task_type=TaskType.FEATURE, priority=TaskPriority.LOW)
        t1.estimated_hours = 4.0
        manager.log_time(t1.id, "user1", 60)

        stats = manager.get_stats()

        assert stats["total_tasks"] == 2
        assert stats["by_type"]["bug"] == 1
        assert stats["by_type"]["feature"] == 1


# ==================== Global Functions Tests ====================

class TestGlobalFunctions:
    """Tests for global task manager functions."""

    def test_get_set_task_manager(self):
        """Test get/set task manager."""
        reset_task_manager()

        assert get_task_manager() is None

        manager = TaskManager()
        set_task_manager(manager)

        assert get_task_manager() == manager

    def test_reset_task_manager(self):
        """Test resetting task manager."""
        manager = TaskManager()
        set_task_manager(manager)

        reset_task_manager()

        assert get_task_manager() is None


# ==================== Edge Cases Tests ====================

class TestEdgeCases:
    """Tests for edge cases."""

    def test_empty_title(self):
        """Test task with empty title."""
        manager = TaskManager()

        task = manager.create_task(title="")

        assert task.title == ""

    def test_many_assignees(self):
        """Test task with many assignees."""
        manager = TaskManager()

        assignees = {f"user{i}" for i in range(20)}
        task = manager.create_task(title="Test", assignee_ids=assignees)

        assert len(task.assignee_ids) == 20

    def test_deep_subtask_hierarchy(self):
        """Test deep subtask hierarchy."""
        manager = TaskManager()

        parent = manager.create_task(title="Level 0")
        current = parent

        for i in range(1, 5):
            child = manager.create_task(title=f"Level {i}", parent_id=current.id)
            current = child

        # Verify hierarchy
        subtasks = manager.get_subtasks(parent.id)
        assert len(subtasks) == 1

    def test_large_checklist(self):
        """Test task with large checklist."""
        manager = TaskManager()

        task = manager.create_task(title="Test")

        for i in range(50):
            manager.add_checklist_item(task.id, f"Step {i}")

        assert len(task.checklist) == 50

    def test_unicode_content(self):
        """Test unicode content in tasks."""
        manager = TaskManager()

        task = manager.create_task(
            title="日本語タスク",
            description="这是一个测试 🚀"
        )

        assert "日本語" in task.title
        assert "🚀" in task.description

    def test_filter_by_multiple_statuses(self):
        """Test filtering by multiple statuses."""
        manager = TaskManager()

        t1 = manager.create_task(title="T1")
        manager.update_task(t1.id, status=TaskStatus.TODO)

        t2 = manager.create_task(title="T2")
        manager.update_task(t2.id, status=TaskStatus.IN_PROGRESS)

        t3 = manager.create_task(title="T3")
        manager.update_task(t3.id, status=TaskStatus.COMPLETED)

        tasks = manager.list_tasks(statuses=[TaskStatus.TODO, TaskStatus.IN_PROGRESS])
        assert len(tasks) == 2

    def test_due_date_filters(self):
        """Test filtering by due date range."""
        manager = TaskManager()

        now = datetime.utcnow()

        t1 = manager.create_task(title="T1")
        manager.update_task(t1.id, due_date=now - timedelta(days=5))

        t2 = manager.create_task(title="T2")
        manager.update_task(t2.id, due_date=now + timedelta(days=5))

        t3 = manager.create_task(title="T3")
        manager.update_task(t3.id, due_date=now + timedelta(days=10))

        # Due before next week
        tasks = manager.list_tasks(due_before=now + timedelta(days=7))
        assert len(tasks) == 2

        # Due after today
        tasks = manager.list_tasks(due_after=now)
        assert len(tasks) == 2
