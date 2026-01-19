"""
Task Management Module

Implements task management functionality with:
- Task creation and lifecycle management
- Task assignments and ownership
- Due dates, priorities, and scheduling
- Task dependencies and relationships
- Task lists, boards, and organization
- Subtasks and checklists
- Task comments and activity
- Recurring tasks
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
import time
import re


# ==================== Enums ====================

class TaskStatus(Enum):
    """Task status."""
    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class TaskPriority(Enum):
    """Task priority levels."""
    LOWEST = "lowest"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    HIGHEST = "highest"
    URGENT = "urgent"


class TaskType(Enum):
    """Types of tasks."""
    TASK = "task"
    BUG = "bug"
    FEATURE = "feature"
    IMPROVEMENT = "improvement"
    EPIC = "epic"
    STORY = "story"
    SUBTASK = "subtask"
    MILESTONE = "milestone"


class RecurrencePattern(Enum):
    """Task recurrence patterns."""
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class DependencyType(Enum):
    """Types of task dependencies."""
    BLOCKS = "blocks"  # This task blocks another
    BLOCKED_BY = "blocked_by"  # This task is blocked by another
    RELATES_TO = "relates_to"  # Related tasks
    DUPLICATES = "duplicates"  # Duplicate of another task
    PARENT_OF = "parent_of"  # Parent task
    CHILD_OF = "child_of"  # Child/subtask


class BoardViewType(Enum):
    """Board view types."""
    KANBAN = "kanban"
    LIST = "list"
    CALENDAR = "calendar"
    TIMELINE = "timeline"
    TABLE = "table"


class SortField(Enum):
    """Fields for sorting tasks."""
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    DUE_DATE = "due_date"
    PRIORITY = "priority"
    STATUS = "status"
    TITLE = "title"


class SortOrder(Enum):
    """Sort order."""
    ASC = "asc"
    DESC = "desc"


# ==================== Data Classes ====================

@dataclass
class ChecklistItem:
    """An item in a task checklist."""
    id: str
    text: str
    is_completed: bool = False
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    order: int = 0

    def complete(self, user_id: Optional[str] = None) -> None:
        """Mark item as completed."""
        self.is_completed = True
        self.completed_at = datetime.utcnow()
        self.completed_by = user_id

    def uncomplete(self) -> None:
        """Mark item as not completed."""
        self.is_completed = False
        self.completed_at = None
        self.completed_by = None


@dataclass
class TaskComment:
    """A comment on a task."""
    id: str
    task_id: str
    author_id: str
    content: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    parent_id: Optional[str] = None  # For replies
    mentions: Set[str] = field(default_factory=set)
    attachments: List[str] = field(default_factory=list)
    is_edited: bool = False
    is_deleted: bool = False

    def edit(self, new_content: str) -> None:
        """Edit the comment."""
        self.content = new_content
        self.updated_at = datetime.utcnow()
        self.is_edited = True
        # Re-extract mentions
        self.mentions = self._extract_mentions(new_content)

    @staticmethod
    def _extract_mentions(content: str) -> Set[str]:
        """Extract @mentions from content."""
        pattern = r'@(\w+)'
        return set(re.findall(pattern, content))


@dataclass
class TaskDependency:
    """A dependency between tasks."""
    id: str
    source_task_id: str
    target_task_id: str
    dependency_type: DependencyType
    created_at: datetime = field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None


@dataclass
class RecurrenceRule:
    """Rule for recurring tasks."""
    pattern: RecurrencePattern
    interval: int = 1  # Every N days/weeks/months
    days_of_week: List[int] = field(default_factory=list)  # 0=Mon, 6=Sun
    day_of_month: Optional[int] = None
    end_date: Optional[datetime] = None
    max_occurrences: Optional[int] = None
    occurrences_created: int = 0

    def get_next_due_date(self, from_date: datetime) -> Optional[datetime]:
        """Calculate the next due date."""
        if self.end_date and from_date >= self.end_date:
            return None
        if self.max_occurrences and self.occurrences_created >= self.max_occurrences:
            return None

        if self.pattern == RecurrencePattern.DAILY:
            return from_date + timedelta(days=self.interval)
        elif self.pattern == RecurrencePattern.WEEKLY:
            return from_date + timedelta(weeks=self.interval)
        elif self.pattern == RecurrencePattern.BIWEEKLY:
            return from_date + timedelta(weeks=2 * self.interval)
        elif self.pattern == RecurrencePattern.MONTHLY:
            # Simple month addition
            month = from_date.month + self.interval
            year = from_date.year + (month - 1) // 12
            month = ((month - 1) % 12) + 1
            day = min(from_date.day, 28)  # Safe day
            return from_date.replace(year=year, month=month, day=day)
        elif self.pattern == RecurrencePattern.QUARTERLY:
            month = from_date.month + (3 * self.interval)
            year = from_date.year + (month - 1) // 12
            month = ((month - 1) % 12) + 1
            day = min(from_date.day, 28)
            return from_date.replace(year=year, month=month, day=day)
        elif self.pattern == RecurrencePattern.YEARLY:
            return from_date.replace(year=from_date.year + self.interval)

        return None


@dataclass
class TaskAssignment:
    """Assignment of a task to a user."""
    id: str
    task_id: str
    user_id: str
    assigned_by: Optional[str] = None
    assigned_at: datetime = field(default_factory=datetime.utcnow)
    role: str = "assignee"  # assignee, reviewer, watcher


@dataclass
class TimeEntry:
    """Time tracking entry for a task."""
    id: str
    task_id: str
    user_id: str
    duration_minutes: int
    description: str = ""
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Task:
    """A task in the system."""
    id: str
    title: str
    task_type: TaskType = TaskType.TASK
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    description: str = ""

    # Ownership
    creator_id: Optional[str] = None
    owner_id: Optional[str] = None
    assignee_ids: Set[str] = field(default_factory=set)
    watcher_ids: Set[str] = field(default_factory=set)

    # Organization
    workspace_id: Optional[str] = None
    project_id: Optional[str] = None
    list_id: Optional[str] = None
    parent_id: Optional[str] = None  # For subtasks

    # Dates
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    due_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Content
    tags: Set[str] = field(default_factory=set)
    labels: Dict[str, str] = field(default_factory=dict)
    checklist: List[ChecklistItem] = field(default_factory=list)
    attachments: List[str] = field(default_factory=list)

    # Estimates
    estimated_hours: Optional[float] = None
    actual_hours: float = 0.0
    story_points: Optional[int] = None

    # Recurrence
    recurrence: Optional[RecurrenceRule] = None
    recurrence_parent_id: Optional[str] = None

    # Custom fields
    custom_fields: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Counters
    comment_count: int = 0
    subtask_count: int = 0
    completed_subtask_count: int = 0

    def assign(self, user_id: str) -> None:
        """Assign the task to a user."""
        self.assignee_ids.add(user_id)
        self.updated_at = datetime.utcnow()

    def unassign(self, user_id: str) -> bool:
        """Unassign a user from the task."""
        if user_id in self.assignee_ids:
            self.assignee_ids.discard(user_id)
            self.updated_at = datetime.utcnow()
            return True
        return False

    def add_watcher(self, user_id: str) -> None:
        """Add a watcher to the task."""
        self.watcher_ids.add(user_id)
        self.updated_at = datetime.utcnow()

    def remove_watcher(self, user_id: str) -> bool:
        """Remove a watcher from the task."""
        if user_id in self.watcher_ids:
            self.watcher_ids.discard(user_id)
            self.updated_at = datetime.utcnow()
            return True
        return False

    def add_tag(self, tag: str) -> None:
        """Add a tag to the task."""
        self.tags.add(tag.lower().strip())
        self.updated_at = datetime.utcnow()

    def remove_tag(self, tag: str) -> bool:
        """Remove a tag from the task."""
        tag_lower = tag.lower().strip()
        if tag_lower in self.tags:
            self.tags.discard(tag_lower)
            self.updated_at = datetime.utcnow()
            return True
        return False

    def set_status(self, status: TaskStatus) -> None:
        """Set the task status."""
        self.status = status
        self.updated_at = datetime.utcnow()
        if status == TaskStatus.COMPLETED:
            self.completed_at = datetime.utcnow()
        elif self.completed_at and status != TaskStatus.COMPLETED:
            self.completed_at = None

    def add_checklist_item(self, item: ChecklistItem) -> None:
        """Add a checklist item."""
        self.checklist.append(item)
        self.updated_at = datetime.utcnow()

    def complete_checklist_item(self, item_id: str, user_id: Optional[str] = None) -> bool:
        """Complete a checklist item."""
        for item in self.checklist:
            if item.id == item_id:
                item.complete(user_id)
                self.updated_at = datetime.utcnow()
                return True
        return False

    @property
    def checklist_progress(self) -> float:
        """Get checklist completion progress (0.0 - 1.0)."""
        if not self.checklist:
            return 1.0
        completed = sum(1 for item in self.checklist if item.is_completed)
        return completed / len(self.checklist)

    @property
    def is_overdue(self) -> bool:
        """Check if task is overdue."""
        if not self.due_date:
            return False
        if self.status == TaskStatus.COMPLETED:
            return False
        return datetime.utcnow() > self.due_date

    @property
    def days_until_due(self) -> Optional[int]:
        """Get days until due date."""
        if not self.due_date:
            return None
        delta = self.due_date - datetime.utcnow()
        return delta.days

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "type": self.task_type.value,
            "status": self.status.value,
            "priority": self.priority.value,
            "description": self.description,
            "assignee_ids": list(self.assignee_ids),
            "tags": list(self.tags),
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "checklist_progress": self.checklist_progress,
            "is_overdue": self.is_overdue,
        }


@dataclass
class TaskList:
    """A list/group of tasks."""
    id: str
    name: str
    description: str = ""
    workspace_id: Optional[str] = None
    project_id: Optional[str] = None
    owner_id: Optional[str] = None
    task_ids: List[str] = field(default_factory=list)  # Ordered list
    color: Optional[str] = None
    icon: Optional[str] = None
    is_archived: bool = False
    default_status: TaskStatus = TaskStatus.TODO
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_task(self, task_id: str, position: Optional[int] = None) -> None:
        """Add a task to the list."""
        if task_id not in self.task_ids:
            if position is not None and 0 <= position <= len(self.task_ids):
                self.task_ids.insert(position, task_id)
            else:
                self.task_ids.append(task_id)
            self.updated_at = datetime.utcnow()

    def remove_task(self, task_id: str) -> bool:
        """Remove a task from the list."""
        if task_id in self.task_ids:
            self.task_ids.remove(task_id)
            self.updated_at = datetime.utcnow()
            return True
        return False

    def reorder_task(self, task_id: str, new_position: int) -> bool:
        """Reorder a task in the list."""
        if task_id not in self.task_ids:
            return False
        self.task_ids.remove(task_id)
        self.task_ids.insert(max(0, min(new_position, len(self.task_ids))), task_id)
        self.updated_at = datetime.utcnow()
        return True

    @property
    def task_count(self) -> int:
        """Get number of tasks in list."""
        return len(self.task_ids)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "task_count": self.task_count,
            "color": self.color,
            "is_archived": self.is_archived,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class BoardColumn:
    """A column in a task board."""
    id: str
    name: str
    status: TaskStatus
    task_ids: List[str] = field(default_factory=list)
    wip_limit: Optional[int] = None  # Work in progress limit
    color: Optional[str] = None
    order: int = 0

    @property
    def task_count(self) -> int:
        """Get number of tasks in column."""
        return len(self.task_ids)

    @property
    def is_at_wip_limit(self) -> bool:
        """Check if column is at WIP limit."""
        if self.wip_limit is None:
            return False
        return len(self.task_ids) >= self.wip_limit


@dataclass
class TaskBoard:
    """A kanban-style task board."""
    id: str
    name: str
    description: str = ""
    workspace_id: Optional[str] = None
    project_id: Optional[str] = None
    owner_id: Optional[str] = None
    columns: List[BoardColumn] = field(default_factory=list)
    view_type: BoardViewType = BoardViewType.KANBAN
    filters: Dict[str, Any] = field(default_factory=dict)
    is_archived: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_column(self, column: BoardColumn) -> None:
        """Add a column to the board."""
        self.columns.append(column)
        self.columns.sort(key=lambda c: c.order)
        self.updated_at = datetime.utcnow()

    def remove_column(self, column_id: str) -> bool:
        """Remove a column from the board."""
        for i, col in enumerate(self.columns):
            if col.id == column_id:
                self.columns.pop(i)
                self.updated_at = datetime.utcnow()
                return True
        return False

    def get_column(self, column_id: str) -> Optional[BoardColumn]:
        """Get a column by ID."""
        for col in self.columns:
            if col.id == column_id:
                return col
        return None

    def get_column_by_status(self, status: TaskStatus) -> Optional[BoardColumn]:
        """Get a column by status."""
        for col in self.columns:
            if col.status == status:
                return col
        return None

    def move_task(self, task_id: str, to_column_id: str, position: int = -1) -> bool:
        """Move a task between columns."""
        # Remove from current column
        for col in self.columns:
            if task_id in col.task_ids:
                col.task_ids.remove(task_id)
                break

        # Add to new column
        to_column = self.get_column(to_column_id)
        if not to_column:
            return False

        if position >= 0 and position < len(to_column.task_ids):
            to_column.task_ids.insert(position, task_id)
        else:
            to_column.task_ids.append(task_id)

        self.updated_at = datetime.utcnow()
        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "view_type": self.view_type.value,
            "columns": [
                {"id": c.id, "name": c.name, "task_count": c.task_count}
                for c in self.columns
            ],
            "is_archived": self.is_archived,
            "created_at": self.created_at.isoformat(),
        }


# ==================== Task Registry ====================

class TaskRegistry:
    """Central registry for managing tasks."""

    _counter: int = 0

    def __init__(self):
        self._tasks: Dict[str, Task] = {}
        self._lists: Dict[str, TaskList] = {}
        self._boards: Dict[str, TaskBoard] = {}
        self._comments: Dict[str, TaskComment] = {}
        self._dependencies: Dict[str, TaskDependency] = {}
        self._time_entries: Dict[str, TimeEntry] = {}
        self._workspace_tasks: Dict[str, Set[str]] = {}
        self._project_tasks: Dict[str, Set[str]] = {}
        self._user_tasks: Dict[str, Set[str]] = {}  # user -> assigned tasks
        self._tag_index: Dict[str, Set[str]] = {}  # tag -> task_ids

    def create_task(
        self,
        title: str,
        task_type: TaskType = TaskType.TASK,
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        creator_id: Optional[str] = None,
        **kwargs
    ) -> Task:
        """Create a new task."""
        TaskRegistry._counter += 1
        task_id = f"task_{int(time.time() * 1000)}_{TaskRegistry._counter}"

        task = Task(
            id=task_id,
            title=title,
            task_type=task_type,
            workspace_id=workspace_id,
            project_id=project_id,
            creator_id=creator_id,
            owner_id=creator_id,
            **kwargs
        )

        self._tasks[task_id] = task

        # Index by workspace
        if workspace_id:
            if workspace_id not in self._workspace_tasks:
                self._workspace_tasks[workspace_id] = set()
            self._workspace_tasks[workspace_id].add(task_id)

        # Index by project
        if project_id:
            if project_id not in self._project_tasks:
                self._project_tasks[project_id] = set()
            self._project_tasks[project_id].add(task_id)

        return task

    def get_task(self, task_id: str) -> Optional[Task]:
        """Get a task by ID."""
        return self._tasks.get(task_id)

    def update_task(self, task: Task) -> bool:
        """Update a task."""
        if task.id not in self._tasks:
            return False

        task.updated_at = datetime.utcnow()
        self._tasks[task.id] = task

        # Update indexes
        self._update_user_index(task)
        self._update_tag_index(task)

        return True

    def delete_task(self, task_id: str, soft_delete: bool = True) -> bool:
        """Delete a task."""
        task = self._tasks.get(task_id)
        if not task:
            return False

        if soft_delete:
            task.status = TaskStatus.ARCHIVED
            task.updated_at = datetime.utcnow()
        else:
            # Remove from indexes
            if task.workspace_id and task.workspace_id in self._workspace_tasks:
                self._workspace_tasks[task.workspace_id].discard(task_id)

            if task.project_id and task.project_id in self._project_tasks:
                self._project_tasks[task.project_id].discard(task_id)

            for user_id in task.assignee_ids:
                if user_id in self._user_tasks:
                    self._user_tasks[user_id].discard(task_id)

            for tag in task.tags:
                if tag in self._tag_index:
                    self._tag_index[tag].discard(task_id)

            # Remove from lists
            for task_list in self._lists.values():
                task_list.remove_task(task_id)

            # Remove from boards
            for board in self._boards.values():
                for column in board.columns:
                    if task_id in column.task_ids:
                        column.task_ids.remove(task_id)

            del self._tasks[task_id]

        return True

    def _update_user_index(self, task: Task) -> None:
        """Update user index for task."""
        # Remove from old assignments
        for user_id, task_ids in self._user_tasks.items():
            task_ids.discard(task.id)

        # Add current assignments
        for user_id in task.assignee_ids:
            if user_id not in self._user_tasks:
                self._user_tasks[user_id] = set()
            self._user_tasks[user_id].add(task.id)

    def _update_tag_index(self, task: Task) -> None:
        """Update tag index for task."""
        # Remove old tags
        for tag, task_ids in self._tag_index.items():
            task_ids.discard(task.id)

        # Add current tags
        for tag in task.tags:
            if tag not in self._tag_index:
                self._tag_index[tag] = set()
            self._tag_index[tag].add(task.id)

    def list_tasks(
        self,
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        list_id: Optional[str] = None,
        assignee_id: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        statuses: Optional[List[TaskStatus]] = None,
        priority: Optional[TaskPriority] = None,
        task_type: Optional[TaskType] = None,
        tags: Optional[Set[str]] = None,
        parent_id: Optional[str] = None,
        is_overdue: Optional[bool] = None,
        due_before: Optional[datetime] = None,
        due_after: Optional[datetime] = None,
        sort_field: SortField = SortField.CREATED_AT,
        sort_order: SortOrder = SortOrder.DESC,
        limit: int = 100,
        offset: int = 0
    ) -> List[Task]:
        """List tasks matching criteria."""
        # Start with filtered set
        if assignee_id and assignee_id in self._user_tasks:
            task_ids = self._user_tasks[assignee_id]
            tasks = [self._tasks[tid] for tid in task_ids if tid in self._tasks]
        elif workspace_id and workspace_id in self._workspace_tasks:
            task_ids = self._workspace_tasks[workspace_id]
            tasks = [self._tasks[tid] for tid in task_ids if tid in self._tasks]
        elif project_id and project_id in self._project_tasks:
            task_ids = self._project_tasks[project_id]
            tasks = [self._tasks[tid] for tid in task_ids if tid in self._tasks]
        else:
            tasks = list(self._tasks.values())

        # Filter by list
        if list_id:
            task_list = self._lists.get(list_id)
            if task_list:
                list_task_ids = set(task_list.task_ids)
                tasks = [t for t in tasks if t.id in list_task_ids]

        # Filter by status
        if status:
            tasks = [t for t in tasks if t.status == status]
        elif statuses:
            tasks = [t for t in tasks if t.status in statuses]
        else:
            # Exclude archived by default
            tasks = [t for t in tasks if t.status != TaskStatus.ARCHIVED]

        # Filter by priority
        if priority:
            tasks = [t for t in tasks if t.priority == priority]

        # Filter by type
        if task_type:
            tasks = [t for t in tasks if t.task_type == task_type]

        # Filter by tags
        if tags:
            tasks = [t for t in tasks if tags.issubset(t.tags)]

        # Filter by parent
        if parent_id is not None:
            tasks = [t for t in tasks if t.parent_id == parent_id]

        # Filter by overdue
        if is_overdue is not None:
            tasks = [t for t in tasks if t.is_overdue == is_overdue]

        # Filter by due date range
        if due_before:
            tasks = [t for t in tasks if t.due_date and t.due_date <= due_before]
        if due_after:
            tasks = [t for t in tasks if t.due_date and t.due_date >= due_after]

        # Sort
        priority_order = {
            TaskPriority.URGENT: 0,
            TaskPriority.HIGHEST: 1,
            TaskPriority.HIGH: 2,
            TaskPriority.MEDIUM: 3,
            TaskPriority.LOW: 4,
            TaskPriority.LOWEST: 5,
        }

        reverse = sort_order == SortOrder.DESC
        if sort_field == SortField.CREATED_AT:
            tasks.sort(key=lambda t: t.created_at, reverse=reverse)
        elif sort_field == SortField.UPDATED_AT:
            tasks.sort(key=lambda t: t.updated_at, reverse=reverse)
        elif sort_field == SortField.DUE_DATE:
            tasks.sort(key=lambda t: t.due_date or datetime.max, reverse=reverse)
        elif sort_field == SortField.PRIORITY:
            tasks.sort(key=lambda t: priority_order.get(t.priority, 99), reverse=reverse)
        elif sort_field == SortField.STATUS:
            tasks.sort(key=lambda t: t.status.value, reverse=reverse)
        elif sort_field == SortField.TITLE:
            tasks.sort(key=lambda t: t.title.lower(), reverse=reverse)

        # Paginate
        return tasks[offset:offset + limit]

    def search_tasks(
        self,
        query: str,
        workspace_id: Optional[str] = None
    ) -> List[Task]:
        """Search tasks by title or description."""
        query_lower = query.lower()
        tasks = self.list_tasks(workspace_id=workspace_id, limit=10000)

        results = []
        for task in tasks:
            if (query_lower in task.title.lower() or
                query_lower in task.description.lower() or
                any(query_lower in tag for tag in task.tags)):
                results.append(task)

        return results

    def get_subtasks(self, parent_id: str) -> List[Task]:
        """Get subtasks of a task."""
        return [t for t in self._tasks.values() if t.parent_id == parent_id]

    def get_user_tasks(self, user_id: str) -> List[Task]:
        """Get tasks assigned to a user."""
        task_ids = self._user_tasks.get(user_id, set())
        return [self._tasks[tid] for tid in task_ids if tid in self._tasks]

    def get_overdue_tasks(self, workspace_id: Optional[str] = None) -> List[Task]:
        """Get all overdue tasks."""
        return self.list_tasks(workspace_id=workspace_id, is_overdue=True, limit=10000)

    # Task List management
    def create_list(
        self,
        name: str,
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        **kwargs
    ) -> TaskList:
        """Create a new task list."""
        TaskRegistry._counter += 1
        list_id = f"list_{int(time.time() * 1000)}_{TaskRegistry._counter}"

        task_list = TaskList(
            id=list_id,
            name=name,
            workspace_id=workspace_id,
            project_id=project_id,
            owner_id=owner_id,
            **kwargs
        )

        self._lists[list_id] = task_list
        return task_list

    def get_list(self, list_id: str) -> Optional[TaskList]:
        """Get a task list by ID."""
        return self._lists.get(list_id)

    def update_list(self, task_list: TaskList) -> bool:
        """Update a task list."""
        if task_list.id not in self._lists:
            return False

        task_list.updated_at = datetime.utcnow()
        self._lists[task_list.id] = task_list
        return True

    def delete_list(self, list_id: str) -> bool:
        """Delete a task list."""
        if list_id not in self._lists:
            return False

        del self._lists[list_id]
        return True

    def list_lists(
        self,
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        include_archived: bool = False
    ) -> List[TaskList]:
        """List task lists."""
        lists = list(self._lists.values())

        if workspace_id:
            lists = [l for l in lists if l.workspace_id == workspace_id]

        if project_id:
            lists = [l for l in lists if l.project_id == project_id]

        if not include_archived:
            lists = [l for l in lists if not l.is_archived]

        return lists

    def add_task_to_list(self, task_id: str, list_id: str, position: Optional[int] = None) -> bool:
        """Add a task to a list."""
        task = self._tasks.get(task_id)
        task_list = self._lists.get(list_id)

        if not task or not task_list:
            return False

        task_list.add_task(task_id, position)
        task.list_id = list_id
        task.updated_at = datetime.utcnow()

        return True

    def remove_task_from_list(self, task_id: str, list_id: str) -> bool:
        """Remove a task from a list."""
        task = self._tasks.get(task_id)
        task_list = self._lists.get(list_id)

        if not task or not task_list:
            return False

        task_list.remove_task(task_id)
        if task.list_id == list_id:
            task.list_id = None
        task.updated_at = datetime.utcnow()

        return True

    # Board management
    def create_board(
        self,
        name: str,
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        **kwargs
    ) -> TaskBoard:
        """Create a new task board."""
        TaskRegistry._counter += 1
        board_id = f"board_{int(time.time() * 1000)}_{TaskRegistry._counter}"

        board = TaskBoard(
            id=board_id,
            name=name,
            workspace_id=workspace_id,
            project_id=project_id,
            owner_id=owner_id,
            **kwargs
        )

        self._boards[board_id] = board
        return board

    def get_board(self, board_id: str) -> Optional[TaskBoard]:
        """Get a board by ID."""
        return self._boards.get(board_id)

    def update_board(self, board: TaskBoard) -> bool:
        """Update a board."""
        if board.id not in self._boards:
            return False

        board.updated_at = datetime.utcnow()
        self._boards[board.id] = board
        return True

    def delete_board(self, board_id: str) -> bool:
        """Delete a board."""
        if board_id not in self._boards:
            return False

        del self._boards[board_id]
        return True

    def list_boards(
        self,
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        include_archived: bool = False
    ) -> List[TaskBoard]:
        """List boards."""
        boards = list(self._boards.values())

        if workspace_id:
            boards = [b for b in boards if b.workspace_id == workspace_id]

        if project_id:
            boards = [b for b in boards if b.project_id == project_id]

        if not include_archived:
            boards = [b for b in boards if not b.is_archived]

        return boards

    # Comment management
    def add_comment(
        self,
        task_id: str,
        author_id: str,
        content: str,
        parent_id: Optional[str] = None
    ) -> Optional[TaskComment]:
        """Add a comment to a task."""
        task = self._tasks.get(task_id)
        if not task:
            return None

        TaskRegistry._counter += 1
        comment_id = f"comment_{int(time.time() * 1000)}_{TaskRegistry._counter}"

        comment = TaskComment(
            id=comment_id,
            task_id=task_id,
            author_id=author_id,
            content=content,
            parent_id=parent_id,
            mentions=TaskComment._extract_mentions(content)
        )

        self._comments[comment_id] = comment
        task.comment_count += 1
        task.updated_at = datetime.utcnow()

        return comment

    def get_comment(self, comment_id: str) -> Optional[TaskComment]:
        """Get a comment by ID."""
        return self._comments.get(comment_id)

    def get_task_comments(self, task_id: str) -> List[TaskComment]:
        """Get all comments for a task."""
        return [c for c in self._comments.values() if c.task_id == task_id and not c.is_deleted]

    def delete_comment(self, comment_id: str) -> bool:
        """Soft delete a comment."""
        comment = self._comments.get(comment_id)
        if not comment:
            return False

        comment.is_deleted = True
        task = self._tasks.get(comment.task_id)
        if task:
            task.comment_count = max(0, task.comment_count - 1)

        return True

    # Dependency management
    def add_dependency(
        self,
        source_task_id: str,
        target_task_id: str,
        dependency_type: DependencyType,
        created_by: Optional[str] = None
    ) -> Optional[TaskDependency]:
        """Add a dependency between tasks."""
        source = self._tasks.get(source_task_id)
        target = self._tasks.get(target_task_id)

        if not source or not target:
            return None

        # Prevent self-dependency
        if source_task_id == target_task_id:
            return None

        TaskRegistry._counter += 1
        dep_id = f"dep_{int(time.time() * 1000)}_{TaskRegistry._counter}"

        dependency = TaskDependency(
            id=dep_id,
            source_task_id=source_task_id,
            target_task_id=target_task_id,
            dependency_type=dependency_type,
            created_by=created_by
        )

        self._dependencies[dep_id] = dependency
        return dependency

    def get_dependencies(self, task_id: str) -> List[TaskDependency]:
        """Get all dependencies for a task."""
        return [
            d for d in self._dependencies.values()
            if d.source_task_id == task_id or d.target_task_id == task_id
        ]

    def get_blocking_tasks(self, task_id: str) -> List[Task]:
        """Get tasks that block this task."""
        blocking_ids = [
            d.source_task_id for d in self._dependencies.values()
            if d.target_task_id == task_id and d.dependency_type == DependencyType.BLOCKED_BY
        ]
        return [self._tasks[tid] for tid in blocking_ids if tid in self._tasks]

    def remove_dependency(self, dependency_id: str) -> bool:
        """Remove a dependency."""
        if dependency_id not in self._dependencies:
            return False

        del self._dependencies[dependency_id]
        return True

    # Time tracking
    def add_time_entry(
        self,
        task_id: str,
        user_id: str,
        duration_minutes: int,
        description: str = "",
        started_at: Optional[datetime] = None
    ) -> Optional[TimeEntry]:
        """Add a time entry to a task."""
        task = self._tasks.get(task_id)
        if not task:
            return None

        TaskRegistry._counter += 1
        entry_id = f"time_{int(time.time() * 1000)}_{TaskRegistry._counter}"

        entry = TimeEntry(
            id=entry_id,
            task_id=task_id,
            user_id=user_id,
            duration_minutes=duration_minutes,
            description=description,
            started_at=started_at
        )

        self._time_entries[entry_id] = entry
        task.actual_hours += duration_minutes / 60.0
        task.updated_at = datetime.utcnow()

        return entry

    def get_task_time_entries(self, task_id: str) -> List[TimeEntry]:
        """Get all time entries for a task."""
        return [e for e in self._time_entries.values() if e.task_id == task_id]

    def get_user_time_entries(
        self,
        user_id: str,
        since: Optional[datetime] = None
    ) -> List[TimeEntry]:
        """Get time entries for a user."""
        entries = [e for e in self._time_entries.values() if e.user_id == user_id]
        if since:
            entries = [e for e in entries if e.created_at >= since]
        return entries


# ==================== Task Manager ====================

class TaskManager:
    """High-level manager for tasks."""

    def __init__(self):
        self.registry = TaskRegistry()

    def create_task(
        self,
        title: str,
        task_type: TaskType = TaskType.TASK,
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        creator_id: Optional[str] = None,
        description: str = "",
        priority: TaskPriority = TaskPriority.MEDIUM,
        due_date: Optional[datetime] = None,
        assignee_ids: Optional[Set[str]] = None,
        tags: Optional[Set[str]] = None,
        parent_id: Optional[str] = None
    ) -> Task:
        """Create a new task."""
        task = self.registry.create_task(
            title=title,
            task_type=task_type,
            workspace_id=workspace_id,
            project_id=project_id,
            creator_id=creator_id,
            description=description,
            priority=priority,
            due_date=due_date,
            tags=tags or set(),
            parent_id=parent_id
        )

        if assignee_ids:
            for user_id in assignee_ids:
                task.assign(user_id)
            self.registry.update_task(task)

        # Update parent's subtask count
        if parent_id:
            parent = self.registry.get_task(parent_id)
            if parent:
                parent.subtask_count += 1
                self.registry.update_task(parent)

        return task

    def get_task(self, task_id: str) -> Optional[Task]:
        """Get a task by ID."""
        return self.registry.get_task(task_id)

    def update_task(
        self,
        task_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        priority: Optional[TaskPriority] = None,
        due_date: Optional[datetime] = None,
        tags: Optional[Set[str]] = None
    ) -> Optional[Task]:
        """Update a task."""
        task = self.registry.get_task(task_id)
        if not task:
            return None

        if title is not None:
            task.title = title
        if description is not None:
            task.description = description
        if status is not None:
            old_status = task.status
            task.set_status(status)
            # Update parent's completed subtask count
            if task.parent_id:
                parent = self.registry.get_task(task.parent_id)
                if parent:
                    if status == TaskStatus.COMPLETED and old_status != TaskStatus.COMPLETED:
                        parent.completed_subtask_count += 1
                    elif old_status == TaskStatus.COMPLETED and status != TaskStatus.COMPLETED:
                        parent.completed_subtask_count = max(0, parent.completed_subtask_count - 1)
                    self.registry.update_task(parent)
        if priority is not None:
            task.priority = priority
        if due_date is not None:
            task.due_date = due_date
        if tags is not None:
            task.tags = tags

        self.registry.update_task(task)
        return task

    def delete_task(self, task_id: str, permanent: bool = False) -> bool:
        """Delete a task."""
        task = self.registry.get_task(task_id)
        if not task:
            return False

        # Update parent's subtask count
        if task.parent_id:
            parent = self.registry.get_task(task.parent_id)
            if parent:
                parent.subtask_count = max(0, parent.subtask_count - 1)
                if task.status == TaskStatus.COMPLETED:
                    parent.completed_subtask_count = max(0, parent.completed_subtask_count - 1)
                self.registry.update_task(parent)

        return self.registry.delete_task(task_id, soft_delete=not permanent)

    def complete_task(self, task_id: str) -> Optional[Task]:
        """Mark a task as completed."""
        return self.update_task(task_id, status=TaskStatus.COMPLETED)

    def assign_task(self, task_id: str, user_id: str, assigned_by: Optional[str] = None) -> bool:
        """Assign a task to a user."""
        task = self.registry.get_task(task_id)
        if not task:
            return False

        task.assign(user_id)
        self.registry.update_task(task)
        return True

    def unassign_task(self, task_id: str, user_id: str) -> bool:
        """Unassign a user from a task."""
        task = self.registry.get_task(task_id)
        if not task:
            return False

        if task.unassign(user_id):
            self.registry.update_task(task)
            return True
        return False

    def list_tasks(self, **kwargs) -> List[Task]:
        """List tasks."""
        return self.registry.list_tasks(**kwargs)

    def search_tasks(self, query: str, workspace_id: Optional[str] = None) -> List[Task]:
        """Search tasks."""
        return self.registry.search_tasks(query, workspace_id)

    def get_subtasks(self, task_id: str) -> List[Task]:
        """Get subtasks of a task."""
        return self.registry.get_subtasks(task_id)

    def get_my_tasks(self, user_id: str) -> List[Task]:
        """Get tasks assigned to a user."""
        return self.registry.get_user_tasks(user_id)

    def get_overdue_tasks(self, workspace_id: Optional[str] = None) -> List[Task]:
        """Get overdue tasks."""
        return self.registry.get_overdue_tasks(workspace_id)

    # Checklist operations
    def add_checklist_item(
        self,
        task_id: str,
        text: str
    ) -> Optional[ChecklistItem]:
        """Add a checklist item to a task."""
        task = self.registry.get_task(task_id)
        if not task:
            return None

        TaskRegistry._counter += 1
        item_id = f"check_{int(time.time() * 1000)}_{TaskRegistry._counter}"

        item = ChecklistItem(
            id=item_id,
            text=text,
            order=len(task.checklist)
        )

        task.add_checklist_item(item)
        self.registry.update_task(task)
        return item

    def complete_checklist_item(
        self,
        task_id: str,
        item_id: str,
        user_id: Optional[str] = None
    ) -> bool:
        """Complete a checklist item."""
        task = self.registry.get_task(task_id)
        if not task:
            return False

        if task.complete_checklist_item(item_id, user_id):
            self.registry.update_task(task)
            return True
        return False

    # List operations
    def create_list(
        self,
        name: str,
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        owner_id: Optional[str] = None
    ) -> TaskList:
        """Create a task list."""
        return self.registry.create_list(
            name=name,
            workspace_id=workspace_id,
            project_id=project_id,
            owner_id=owner_id
        )

    def get_list(self, list_id: str) -> Optional[TaskList]:
        """Get a task list."""
        return self.registry.get_list(list_id)

    def delete_list(self, list_id: str) -> bool:
        """Delete a task list."""
        return self.registry.delete_list(list_id)

    def list_lists(self, **kwargs) -> List[TaskList]:
        """List task lists."""
        return self.registry.list_lists(**kwargs)

    def add_to_list(self, task_id: str, list_id: str, position: Optional[int] = None) -> bool:
        """Add a task to a list."""
        return self.registry.add_task_to_list(task_id, list_id, position)

    def remove_from_list(self, task_id: str, list_id: str) -> bool:
        """Remove a task from a list."""
        return self.registry.remove_task_from_list(task_id, list_id)

    # Board operations
    def create_board(
        self,
        name: str,
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        default_columns: bool = True
    ) -> TaskBoard:
        """Create a task board."""
        board = self.registry.create_board(
            name=name,
            workspace_id=workspace_id,
            project_id=project_id,
            owner_id=owner_id
        )

        if default_columns:
            # Add default Kanban columns
            default_cols = [
                (TaskStatus.TODO, "To Do", 0),
                (TaskStatus.IN_PROGRESS, "In Progress", 1),
                (TaskStatus.IN_REVIEW, "Review", 2),
                (TaskStatus.COMPLETED, "Done", 3),
            ]
            for status, name, order in default_cols:
                TaskRegistry._counter += 1
                col_id = f"col_{int(time.time() * 1000)}_{TaskRegistry._counter}"
                column = BoardColumn(
                    id=col_id,
                    name=name,
                    status=status,
                    order=order
                )
                board.add_column(column)

        self.registry.update_board(board)
        return board

    def get_board(self, board_id: str) -> Optional[TaskBoard]:
        """Get a board."""
        return self.registry.get_board(board_id)

    def delete_board(self, board_id: str) -> bool:
        """Delete a board."""
        return self.registry.delete_board(board_id)

    def list_boards(self, **kwargs) -> List[TaskBoard]:
        """List boards."""
        return self.registry.list_boards(**kwargs)

    def move_task_on_board(
        self,
        board_id: str,
        task_id: str,
        to_column_id: str,
        position: int = -1
    ) -> bool:
        """Move a task on a board."""
        board = self.registry.get_board(board_id)
        if not board:
            return False

        if board.move_task(task_id, to_column_id, position):
            # Update task status to match column
            column = board.get_column(to_column_id)
            if column:
                task = self.registry.get_task(task_id)
                if task:
                    task.set_status(column.status)
                    self.registry.update_task(task)
            return True
        return False

    def add_task_to_board(self, task_id: str, board_id: str) -> bool:
        """Add a task to a board."""
        task = self.registry.get_task(task_id)
        board = self.registry.get_board(board_id)

        if not task or not board:
            return False

        # Find appropriate column based on task status
        column = board.get_column_by_status(task.status)
        if not column and board.columns:
            column = board.columns[0]  # Default to first column

        if column:
            column.task_ids.append(task_id)
            self.registry.update_board(board)
            return True

        return False

    # Comment operations
    def add_comment(
        self,
        task_id: str,
        author_id: str,
        content: str,
        parent_id: Optional[str] = None
    ) -> Optional[TaskComment]:
        """Add a comment to a task."""
        return self.registry.add_comment(task_id, author_id, content, parent_id)

    def get_task_comments(self, task_id: str) -> List[TaskComment]:
        """Get comments for a task."""
        return self.registry.get_task_comments(task_id)

    def delete_comment(self, comment_id: str) -> bool:
        """Delete a comment."""
        return self.registry.delete_comment(comment_id)

    # Dependency operations
    def add_dependency(
        self,
        source_task_id: str,
        target_task_id: str,
        dependency_type: DependencyType,
        created_by: Optional[str] = None
    ) -> Optional[TaskDependency]:
        """Add a dependency between tasks."""
        return self.registry.add_dependency(
            source_task_id, target_task_id, dependency_type, created_by
        )

    def get_blocking_tasks(self, task_id: str) -> List[Task]:
        """Get tasks blocking this task."""
        return self.registry.get_blocking_tasks(task_id)

    def remove_dependency(self, dependency_id: str) -> bool:
        """Remove a dependency."""
        return self.registry.remove_dependency(dependency_id)

    # Time tracking
    def log_time(
        self,
        task_id: str,
        user_id: str,
        duration_minutes: int,
        description: str = ""
    ) -> Optional[TimeEntry]:
        """Log time on a task."""
        return self.registry.add_time_entry(
            task_id, user_id, duration_minutes, description
        )

    def get_time_entries(self, task_id: str) -> List[TimeEntry]:
        """Get time entries for a task."""
        return self.registry.get_task_time_entries(task_id)

    def get_stats(self, workspace_id: Optional[str] = None) -> Dict[str, Any]:
        """Get task statistics."""
        tasks = self.registry.list_tasks(workspace_id=workspace_id, limit=100000)

        status_counts: Dict[str, int] = {}
        priority_counts: Dict[str, int] = {}
        type_counts: Dict[str, int] = {}
        overdue_count = 0
        total_estimated_hours = 0.0
        total_actual_hours = 0.0

        for task in tasks:
            status_counts[task.status.value] = status_counts.get(task.status.value, 0) + 1
            priority_counts[task.priority.value] = priority_counts.get(task.priority.value, 0) + 1
            type_counts[task.task_type.value] = type_counts.get(task.task_type.value, 0) + 1

            if task.is_overdue:
                overdue_count += 1
            if task.estimated_hours:
                total_estimated_hours += task.estimated_hours
            total_actual_hours += task.actual_hours

        return {
            "total_tasks": len(tasks),
            "total_lists": len(self.registry._lists),
            "total_boards": len(self.registry._boards),
            "by_status": status_counts,
            "by_priority": priority_counts,
            "by_type": type_counts,
            "overdue_count": overdue_count,
            "total_estimated_hours": total_estimated_hours,
            "total_actual_hours": total_actual_hours,
        }


# ==================== Global Instances ====================

_task_manager: Optional[TaskManager] = None


def get_task_manager() -> Optional[TaskManager]:
    """Get the global task manager."""
    return _task_manager


def set_task_manager(manager: TaskManager) -> None:
    """Set the global task manager."""
    global _task_manager
    _task_manager = manager


def reset_task_manager() -> None:
    """Reset the global task manager."""
    global _task_manager
    _task_manager = None
