"""
Workflow Automation module for SwissBrain.ai collaboration system.

This module provides enterprise workflow features including:
- Automated workflows with triggers and actions
- Approval workflows with multi-level approvals
- Conditional logic and branching
- Scheduled and event-based execution
- Workflow templates and versioning
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Union
import uuid
import re


class WorkflowStatus(str, Enum):
    """Status of a workflow definition."""
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class WorkflowType(str, Enum):
    """Type of workflow."""
    AUTOMATION = "automation"
    APPROVAL = "approval"
    NOTIFICATION = "notification"
    INTEGRATION = "integration"
    CUSTOM = "custom"


class TriggerType(str, Enum):
    """Type of workflow trigger."""
    MANUAL = "manual"
    SCHEDULE = "schedule"
    EVENT = "event"
    WEBHOOK = "webhook"
    CONDITION = "condition"


class StepType(str, Enum):
    """Type of workflow step."""
    ACTION = "action"
    CONDITION = "condition"
    DELAY = "delay"
    LOOP = "loop"
    PARALLEL = "parallel"
    APPROVAL = "approval"
    SUB_WORKFLOW = "sub_workflow"


class ActionType(str, Enum):
    """Type of action to perform."""
    SEND_NOTIFICATION = "send_notification"
    SEND_EMAIL = "send_email"
    UPDATE_FIELD = "update_field"
    CREATE_TASK = "create_task"
    CREATE_COMMENT = "create_comment"
    ASSIGN_USER = "assign_user"
    CHANGE_STATUS = "change_status"
    CALL_WEBHOOK = "call_webhook"
    RUN_SCRIPT = "run_script"
    LOG_MESSAGE = "log_message"
    SET_VARIABLE = "set_variable"


class ConditionOperator(str, Enum):
    """Operators for conditions."""
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    GREATER_OR_EQUAL = "greater_or_equal"
    LESS_OR_EQUAL = "less_or_equal"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"
    MATCHES = "matches"
    IN_LIST = "in_list"
    NOT_IN_LIST = "not_in_list"


class ExecutionStatus(str, Enum):
    """Status of workflow execution."""
    PENDING = "pending"
    RUNNING = "running"
    WAITING = "waiting"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"


class ApprovalStatus(str, Enum):
    """Status of an approval request."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    DELEGATED = "delegated"
    ESCALATED = "escalated"
    EXPIRED = "expired"


class ApprovalType(str, Enum):
    """Type of approval required."""
    SINGLE = "single"
    ALL = "all"
    MAJORITY = "majority"
    ANY = "any"


@dataclass
class WorkflowTrigger:
    """A trigger that starts a workflow."""
    id: str
    trigger_type: TriggerType
    name: str = ""
    description: str = ""
    event_type: str = ""
    schedule_cron: str = ""
    schedule_interval_minutes: int = 0
    conditions: List[Dict[str, Any]] = field(default_factory=list)
    webhook_secret: str = ""
    is_enabled: bool = True
    last_triggered_at: Optional[datetime] = None
    settings: Dict[str, Any] = field(default_factory=dict)

    def should_trigger(self, event_data: Dict[str, Any]) -> bool:
        """Check if trigger should fire based on conditions."""
        if not self.is_enabled:
            return False

        if not self.conditions:
            return True

        for condition in self.conditions:
            field_name = condition.get("field", "")
            operator = condition.get("operator", "equals")
            expected = condition.get("value")
            actual = event_data.get(field_name)

            if not self._evaluate_condition(actual, operator, expected):
                return False

        return True

    def _evaluate_condition(self, actual: Any, operator: str, expected: Any) -> bool:
        """Evaluate a single condition."""
        if operator == "equals":
            return actual == expected
        elif operator == "not_equals":
            return actual != expected
        elif operator == "contains":
            return expected in str(actual) if actual else False
        elif operator == "greater_than":
            try:
                return float(actual) > float(expected)
            except (ValueError, TypeError):
                return False
        elif operator == "less_than":
            try:
                return float(actual) < float(expected)
            except (ValueError, TypeError):
                return False
        elif operator == "is_empty":
            return actual is None or actual == "" or actual == []
        elif operator == "is_not_empty":
            return actual is not None and actual != "" and actual != []
        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "trigger_type": self.trigger_type.value,
            "name": self.name,
            "description": self.description,
            "event_type": self.event_type,
            "schedule_cron": self.schedule_cron,
            "schedule_interval_minutes": self.schedule_interval_minutes,
            "conditions": self.conditions,
            "is_enabled": self.is_enabled,
            "last_triggered_at": self.last_triggered_at.isoformat() if self.last_triggered_at else None,
            "settings": self.settings,
        }


@dataclass
class WorkflowCondition:
    """A condition for branching in workflows."""
    id: str
    field: str
    operator: ConditionOperator
    value: Any
    logic: str = "and"

    def evaluate(self, context: Dict[str, Any]) -> bool:
        """Evaluate the condition against context."""
        actual = self._get_nested_value(context, self.field)

        if self.operator == ConditionOperator.EQUALS:
            return actual == self.value
        elif self.operator == ConditionOperator.NOT_EQUALS:
            return actual != self.value
        elif self.operator == ConditionOperator.CONTAINS:
            if isinstance(actual, str):
                return str(self.value) in actual
            if isinstance(actual, list):
                return self.value in actual
            return False
        elif self.operator == ConditionOperator.NOT_CONTAINS:
            if isinstance(actual, str):
                return str(self.value) not in actual
            if isinstance(actual, list):
                return self.value not in actual
            return True
        elif self.operator == ConditionOperator.GREATER_THAN:
            try:
                return float(actual) > float(self.value)
            except (ValueError, TypeError):
                return False
        elif self.operator == ConditionOperator.LESS_THAN:
            try:
                return float(actual) < float(self.value)
            except (ValueError, TypeError):
                return False
        elif self.operator == ConditionOperator.GREATER_OR_EQUAL:
            try:
                return float(actual) >= float(self.value)
            except (ValueError, TypeError):
                return False
        elif self.operator == ConditionOperator.LESS_OR_EQUAL:
            try:
                return float(actual) <= float(self.value)
            except (ValueError, TypeError):
                return False
        elif self.operator == ConditionOperator.IS_EMPTY:
            return actual is None or actual == "" or actual == []
        elif self.operator == ConditionOperator.IS_NOT_EMPTY:
            return actual is not None and actual != "" and actual != []
        elif self.operator == ConditionOperator.MATCHES:
            try:
                return bool(re.match(str(self.value), str(actual)))
            except re.error:
                return False
        elif self.operator == ConditionOperator.IN_LIST:
            if isinstance(self.value, list):
                return actual in self.value
            return False
        elif self.operator == ConditionOperator.NOT_IN_LIST:
            if isinstance(self.value, list):
                return actual not in self.value
            return True

        return False

    def _get_nested_value(self, data: Dict[str, Any], path: str) -> Any:
        """Get a nested value from a dictionary using dot notation."""
        keys = path.split(".")
        value = data
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None
        return value

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "field": self.field,
            "operator": self.operator.value,
            "value": self.value,
            "logic": self.logic,
        }


@dataclass
class WorkflowAction:
    """An action to perform in a workflow step."""
    id: str
    action_type: ActionType
    name: str = ""
    config: Dict[str, Any] = field(default_factory=dict)
    retry_count: int = 0
    retry_delay_seconds: int = 60
    timeout_seconds: int = 300
    on_error: str = "fail"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "action_type": self.action_type.value,
            "name": self.name,
            "config": self.config,
            "retry_count": self.retry_count,
            "retry_delay_seconds": self.retry_delay_seconds,
            "timeout_seconds": self.timeout_seconds,
            "on_error": self.on_error,
        }


@dataclass
class ApprovalStep:
    """A step in an approval workflow."""
    id: str
    name: str
    approvers: List[str] = field(default_factory=list)
    approval_type: ApprovalType = ApprovalType.SINGLE
    required_approvals: int = 1
    timeout_hours: int = 72
    escalation_user_id: Optional[str] = None
    auto_approve_after_hours: Optional[int] = None
    allow_delegation: bool = True
    notify_on_pending: bool = True
    settings: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "approvers": self.approvers,
            "approval_type": self.approval_type.value,
            "required_approvals": self.required_approvals,
            "timeout_hours": self.timeout_hours,
            "escalation_user_id": self.escalation_user_id,
            "auto_approve_after_hours": self.auto_approve_after_hours,
            "allow_delegation": self.allow_delegation,
            "notify_on_pending": self.notify_on_pending,
            "settings": self.settings,
        }


@dataclass
class WorkflowStep:
    """A step in a workflow."""
    id: str
    workflow_id: str
    step_type: StepType
    name: str
    position: int = 0
    description: str = ""
    action: Optional[WorkflowAction] = None
    conditions: List[WorkflowCondition] = field(default_factory=list)
    approval_step: Optional[ApprovalStep] = None
    delay_seconds: int = 0
    delay_until: Optional[datetime] = None
    next_step_id: Optional[str] = None
    on_true_step_id: Optional[str] = None
    on_false_step_id: Optional[str] = None
    parallel_step_ids: List[str] = field(default_factory=list)
    sub_workflow_id: Optional[str] = None
    loop_config: Dict[str, Any] = field(default_factory=dict)
    is_enabled: bool = True
    settings: Dict[str, Any] = field(default_factory=dict)

    def evaluate_conditions(self, context: Dict[str, Any]) -> bool:
        """Evaluate all conditions."""
        if not self.conditions:
            return True

        results = [c.evaluate(context) for c in self.conditions]

        and_results = []
        or_group = []

        for i, condition in enumerate(self.conditions):
            if condition.logic == "or" and or_group:
                and_results.append(any(or_group))
                or_group = []
            or_group.append(results[i])

        if or_group:
            and_results.append(any(or_group))

        return all(and_results) if and_results else True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "step_type": self.step_type.value,
            "name": self.name,
            "position": self.position,
            "description": self.description,
            "action": self.action.to_dict() if self.action else None,
            "conditions": [c.to_dict() for c in self.conditions],
            "approval_step": self.approval_step.to_dict() if self.approval_step else None,
            "delay_seconds": self.delay_seconds,
            "delay_until": self.delay_until.isoformat() if self.delay_until else None,
            "next_step_id": self.next_step_id,
            "on_true_step_id": self.on_true_step_id,
            "on_false_step_id": self.on_false_step_id,
            "parallel_step_ids": self.parallel_step_ids,
            "sub_workflow_id": self.sub_workflow_id,
            "is_enabled": self.is_enabled,
            "settings": self.settings,
        }


@dataclass
class Workflow:
    """A workflow definition."""
    id: str
    name: str
    creator_id: str
    workflow_type: WorkflowType = WorkflowType.AUTOMATION
    status: WorkflowStatus = WorkflowStatus.DRAFT
    description: str = ""
    workspace_id: Optional[str] = None
    project_id: Optional[str] = None
    version: int = 1
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    tags: Set[str] = field(default_factory=set)
    settings: Dict[str, Any] = field(default_factory=dict)

    def activate(self) -> None:
        """Activate the workflow."""
        self.status = WorkflowStatus.ACTIVE
        self.activated_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def pause(self) -> None:
        """Pause the workflow."""
        self.status = WorkflowStatus.PAUSED
        self.updated_at = datetime.utcnow()

    def archive(self) -> None:
        """Archive the workflow."""
        self.status = WorkflowStatus.ARCHIVED
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "creator_id": self.creator_id,
            "workflow_type": self.workflow_type.value,
            "status": self.status.value,
            "description": self.description,
            "workspace_id": self.workspace_id,
            "project_id": self.project_id,
            "version": self.version,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "activated_at": self.activated_at.isoformat() if self.activated_at else None,
            "tags": list(self.tags),
            "settings": self.settings,
        }


@dataclass
class StepExecution:
    """Execution record for a workflow step."""
    id: str
    execution_id: str
    step_id: str
    status: ExecutionStatus = ExecutionStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    input_data: Dict[str, Any] = field(default_factory=dict)
    output_data: Dict[str, Any] = field(default_factory=dict)
    error_message: str = ""
    retry_count: int = 0
    duration_ms: int = 0

    def start(self) -> None:
        """Mark step as started."""
        self.status = ExecutionStatus.RUNNING
        self.started_at = datetime.utcnow()

    def complete(self, output: Optional[Dict[str, Any]] = None) -> None:
        """Mark step as completed."""
        self.status = ExecutionStatus.COMPLETED
        self.completed_at = datetime.utcnow()
        if output:
            self.output_data = output
        if self.started_at:
            delta = self.completed_at - self.started_at
            self.duration_ms = int(delta.total_seconds() * 1000)

    def fail(self, error: str) -> None:
        """Mark step as failed."""
        self.status = ExecutionStatus.FAILED
        self.completed_at = datetime.utcnow()
        self.error_message = error
        if self.started_at:
            delta = self.completed_at - self.started_at
            self.duration_ms = int(delta.total_seconds() * 1000)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "execution_id": self.execution_id,
            "step_id": self.step_id,
            "status": self.status.value,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "input_data": self.input_data,
            "output_data": self.output_data,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "duration_ms": self.duration_ms,
        }


@dataclass
class WorkflowExecution:
    """An execution instance of a workflow."""
    id: str
    workflow_id: str
    status: ExecutionStatus = ExecutionStatus.PENDING
    triggered_by: str = ""
    trigger_type: TriggerType = TriggerType.MANUAL
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    current_step_id: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)
    variables: Dict[str, Any] = field(default_factory=dict)
    error_message: str = ""
    parent_execution_id: Optional[str] = None

    def start(self) -> None:
        """Start the execution."""
        self.status = ExecutionStatus.RUNNING

    def complete(self) -> None:
        """Mark execution as completed."""
        self.status = ExecutionStatus.COMPLETED
        self.completed_at = datetime.utcnow()

    def fail(self, error: str) -> None:
        """Mark execution as failed."""
        self.status = ExecutionStatus.FAILED
        self.completed_at = datetime.utcnow()
        self.error_message = error

    def cancel(self) -> None:
        """Cancel the execution."""
        self.status = ExecutionStatus.CANCELLED
        self.completed_at = datetime.utcnow()

    def wait(self) -> None:
        """Mark execution as waiting."""
        self.status = ExecutionStatus.WAITING

    def set_variable(self, name: str, value: Any) -> None:
        """Set a variable."""
        self.variables[name] = value

    def get_variable(self, name: str, default: Any = None) -> Any:
        """Get a variable."""
        return self.variables.get(name, default)

    @property
    def duration_seconds(self) -> Optional[float]:
        """Get execution duration in seconds."""
        if self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "status": self.status.value,
            "triggered_by": self.triggered_by,
            "trigger_type": self.trigger_type.value,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "current_step_id": self.current_step_id,
            "context": self.context,
            "variables": self.variables,
            "error_message": self.error_message,
            "duration_seconds": self.duration_seconds,
        }


@dataclass
class ApprovalRequest:
    """A request for approval."""
    id: str
    execution_id: str
    step_id: str
    requester_id: str
    approvers: List[str] = field(default_factory=list)
    status: ApprovalStatus = ApprovalStatus.PENDING
    approval_type: ApprovalType = ApprovalType.SINGLE
    required_approvals: int = 1
    received_approvals: int = 0
    title: str = ""
    description: str = ""
    data: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    due_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    comments: List[Dict[str, Any]] = field(default_factory=list)

    def approve(self, approver_id: str, comment: str = "") -> bool:
        """Record an approval."""
        if approver_id not in self.approvers:
            return False

        self.received_approvals += 1
        self.comments.append({
            "user_id": approver_id,
            "action": "approved",
            "comment": comment,
            "timestamp": datetime.utcnow().isoformat(),
        })

        if self._check_approval_complete():
            self.status = ApprovalStatus.APPROVED
            self.completed_at = datetime.utcnow()

        return True

    def reject(self, approver_id: str, comment: str = "") -> bool:
        """Record a rejection."""
        if approver_id not in self.approvers:
            return False

        self.status = ApprovalStatus.REJECTED
        self.completed_at = datetime.utcnow()
        self.comments.append({
            "user_id": approver_id,
            "action": "rejected",
            "comment": comment,
            "timestamp": datetime.utcnow().isoformat(),
        })
        return True

    def delegate(self, from_user_id: str, to_user_id: str, comment: str = "") -> bool:
        """Delegate approval to another user."""
        if from_user_id not in self.approvers:
            return False

        self.approvers.remove(from_user_id)
        self.approvers.append(to_user_id)
        self.comments.append({
            "user_id": from_user_id,
            "action": "delegated",
            "to_user_id": to_user_id,
            "comment": comment,
            "timestamp": datetime.utcnow().isoformat(),
        })
        return True

    def escalate(self, escalation_user_id: str) -> None:
        """Escalate the approval request."""
        self.status = ApprovalStatus.ESCALATED
        if escalation_user_id not in self.approvers:
            self.approvers.append(escalation_user_id)
        self.comments.append({
            "action": "escalated",
            "to_user_id": escalation_user_id,
            "timestamp": datetime.utcnow().isoformat(),
        })

    def _check_approval_complete(self) -> bool:
        """Check if approval requirements are met."""
        if self.approval_type == ApprovalType.SINGLE:
            return self.received_approvals >= 1
        elif self.approval_type == ApprovalType.ALL:
            return self.received_approvals >= len(self.approvers)
        elif self.approval_type == ApprovalType.MAJORITY:
            return self.received_approvals > len(self.approvers) / 2
        elif self.approval_type == ApprovalType.ANY:
            return self.received_approvals >= self.required_approvals
        return False

    @property
    def is_overdue(self) -> bool:
        """Check if approval is overdue."""
        if self.due_at and self.status == ApprovalStatus.PENDING:
            return datetime.utcnow() > self.due_at
        return False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "execution_id": self.execution_id,
            "step_id": self.step_id,
            "requester_id": self.requester_id,
            "approvers": self.approvers,
            "status": self.status.value,
            "approval_type": self.approval_type.value,
            "required_approvals": self.required_approvals,
            "received_approvals": self.received_approvals,
            "title": self.title,
            "description": self.description,
            "data": self.data,
            "created_at": self.created_at.isoformat(),
            "due_at": self.due_at.isoformat() if self.due_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "comments": self.comments,
            "is_overdue": self.is_overdue,
        }


@dataclass
class WorkflowTemplate:
    """A reusable workflow template."""
    id: str
    name: str
    description: str = ""
    workflow_type: WorkflowType = WorkflowType.AUTOMATION
    category: str = ""
    steps_config: List[Dict[str, Any]] = field(default_factory=list)
    triggers_config: List[Dict[str, Any]] = field(default_factory=list)
    settings: Dict[str, Any] = field(default_factory=dict)
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    is_system: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "workflow_type": self.workflow_type.value,
            "category": self.category,
            "steps_config": self.steps_config,
            "triggers_config": self.triggers_config,
            "settings": self.settings,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
            "is_system": self.is_system,
        }


class WorkflowRegistry:
    """Registry for workflow entities."""

    def __init__(self) -> None:
        """Initialize the registry."""
        self._workflows: Dict[str, Workflow] = {}
        self._triggers: Dict[str, List[WorkflowTrigger]] = {}
        self._steps: Dict[str, List[WorkflowStep]] = {}
        self._executions: Dict[str, List[WorkflowExecution]] = {}
        self._step_executions: Dict[str, List[StepExecution]] = {}
        self._approval_requests: Dict[str, ApprovalRequest] = {}
        self._templates: Dict[str, WorkflowTemplate] = {}
        self._action_handlers: Dict[ActionType, Callable] = {}

    # Workflow CRUD
    def create_workflow(
        self,
        name: str,
        creator_id: str,
        workflow_type: WorkflowType = WorkflowType.AUTOMATION,
        description: str = "",
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        tags: Optional[Set[str]] = None,
    ) -> Workflow:
        """Create a new workflow."""
        workflow_id = str(uuid.uuid4())
        workflow = Workflow(
            id=workflow_id,
            name=name,
            creator_id=creator_id,
            workflow_type=workflow_type,
            description=description,
            workspace_id=workspace_id,
            project_id=project_id,
            tags=tags or set(),
        )

        self._workflows[workflow_id] = workflow
        self._triggers[workflow_id] = []
        self._steps[workflow_id] = []
        self._executions[workflow_id] = []

        return workflow

    def get_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Get a workflow by ID."""
        return self._workflows.get(workflow_id)

    def update_workflow(
        self,
        workflow_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[Set[str]] = None,
    ) -> Optional[Workflow]:
        """Update a workflow."""
        workflow = self._workflows.get(workflow_id)
        if not workflow:
            return None

        if name is not None:
            workflow.name = name
        if description is not None:
            workflow.description = description
        if tags is not None:
            workflow.tags = tags

        workflow.updated_at = datetime.utcnow()
        workflow.version += 1

        return workflow

    def delete_workflow(self, workflow_id: str) -> bool:
        """Delete a workflow."""
        if workflow_id not in self._workflows:
            return False

        del self._workflows[workflow_id]
        self._triggers.pop(workflow_id, None)
        self._steps.pop(workflow_id, None)
        self._executions.pop(workflow_id, None)

        return True

    def activate_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Activate a workflow."""
        workflow = self._workflows.get(workflow_id)
        if workflow:
            workflow.activate()
        return workflow

    def pause_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Pause a workflow."""
        workflow = self._workflows.get(workflow_id)
        if workflow:
            workflow.pause()
        return workflow

    def archive_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Archive a workflow."""
        workflow = self._workflows.get(workflow_id)
        if workflow:
            workflow.archive()
        return workflow

    def list_workflows(
        self,
        creator_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        workflow_type: Optional[WorkflowType] = None,
        status: Optional[WorkflowStatus] = None,
        tags: Optional[Set[str]] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Workflow]:
        """List workflows with filters."""
        workflows = list(self._workflows.values())

        if creator_id:
            workflows = [w for w in workflows if w.creator_id == creator_id]
        if workspace_id:
            workflows = [w for w in workflows if w.workspace_id == workspace_id]
        if workflow_type:
            workflows = [w for w in workflows if w.workflow_type == workflow_type]
        if status:
            workflows = [w for w in workflows if w.status == status]
        if tags:
            workflows = [w for w in workflows if tags & w.tags]

        workflows.sort(key=lambda w: w.created_at, reverse=True)
        return workflows[offset:offset + limit]

    # Trigger methods
    def add_trigger(
        self,
        workflow_id: str,
        trigger_type: TriggerType,
        name: str = "",
        event_type: str = "",
        schedule_cron: str = "",
        schedule_interval_minutes: int = 0,
        conditions: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[WorkflowTrigger]:
        """Add a trigger to a workflow."""
        if workflow_id not in self._workflows:
            return None

        trigger_id = str(uuid.uuid4())
        trigger = WorkflowTrigger(
            id=trigger_id,
            trigger_type=trigger_type,
            name=name,
            event_type=event_type,
            schedule_cron=schedule_cron,
            schedule_interval_minutes=schedule_interval_minutes,
            conditions=conditions or [],
        )

        self._triggers[workflow_id].append(trigger)
        return trigger

    def get_trigger(self, workflow_id: str, trigger_id: str) -> Optional[WorkflowTrigger]:
        """Get a trigger by ID."""
        triggers = self._triggers.get(workflow_id, [])
        for t in triggers:
            if t.id == trigger_id:
                return t
        return None

    def update_trigger(
        self,
        workflow_id: str,
        trigger_id: str,
        is_enabled: Optional[bool] = None,
        conditions: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[WorkflowTrigger]:
        """Update a trigger."""
        trigger = self.get_trigger(workflow_id, trigger_id)
        if not trigger:
            return None

        if is_enabled is not None:
            trigger.is_enabled = is_enabled
        if conditions is not None:
            trigger.conditions = conditions

        return trigger

    def delete_trigger(self, workflow_id: str, trigger_id: str) -> bool:
        """Delete a trigger."""
        triggers = self._triggers.get(workflow_id, [])
        for i, t in enumerate(triggers):
            if t.id == trigger_id:
                del triggers[i]
                return True
        return False

    def get_triggers(self, workflow_id: str) -> List[WorkflowTrigger]:
        """Get all triggers for a workflow."""
        return self._triggers.get(workflow_id, [])

    # Step methods
    def add_step(
        self,
        workflow_id: str,
        step_type: StepType,
        name: str,
        position: Optional[int] = None,
        action: Optional[WorkflowAction] = None,
        conditions: Optional[List[WorkflowCondition]] = None,
        approval_step: Optional[ApprovalStep] = None,
        delay_seconds: int = 0,
        next_step_id: Optional[str] = None,
    ) -> Optional[WorkflowStep]:
        """Add a step to a workflow."""
        if workflow_id not in self._workflows:
            return None

        step_id = str(uuid.uuid4())
        steps = self._steps.get(workflow_id, [])

        if position is None:
            position = len(steps)

        step = WorkflowStep(
            id=step_id,
            workflow_id=workflow_id,
            step_type=step_type,
            name=name,
            position=position,
            action=action,
            conditions=conditions or [],
            approval_step=approval_step,
            delay_seconds=delay_seconds,
            next_step_id=next_step_id,
        )

        steps.append(step)
        steps.sort(key=lambda s: s.position)
        self._steps[workflow_id] = steps

        return step

    def get_step(self, workflow_id: str, step_id: str) -> Optional[WorkflowStep]:
        """Get a step by ID."""
        steps = self._steps.get(workflow_id, [])
        for s in steps:
            if s.id == step_id:
                return s
        return None

    def update_step(
        self,
        workflow_id: str,
        step_id: str,
        name: Optional[str] = None,
        is_enabled: Optional[bool] = None,
        position: Optional[int] = None,
        next_step_id: Optional[str] = None,
    ) -> Optional[WorkflowStep]:
        """Update a step."""
        step = self.get_step(workflow_id, step_id)
        if not step:
            return None

        if name is not None:
            step.name = name
        if is_enabled is not None:
            step.is_enabled = is_enabled
        if position is not None:
            step.position = position
            self._steps[workflow_id].sort(key=lambda s: s.position)
        if next_step_id is not None:
            step.next_step_id = next_step_id

        return step

    def delete_step(self, workflow_id: str, step_id: str) -> bool:
        """Delete a step."""
        steps = self._steps.get(workflow_id, [])
        for i, s in enumerate(steps):
            if s.id == step_id:
                del steps[i]
                return True
        return False

    def get_steps(self, workflow_id: str) -> List[WorkflowStep]:
        """Get all steps for a workflow."""
        return self._steps.get(workflow_id, [])

    def get_first_step(self, workflow_id: str) -> Optional[WorkflowStep]:
        """Get the first step of a workflow."""
        steps = self._steps.get(workflow_id, [])
        return steps[0] if steps else None

    def get_next_step(self, workflow_id: str, current_step_id: str, condition_result: bool = True) -> Optional[WorkflowStep]:
        """Get the next step after current step."""
        step = self.get_step(workflow_id, current_step_id)
        if not step:
            return None

        if step.step_type == StepType.CONDITION:
            next_id = step.on_true_step_id if condition_result else step.on_false_step_id
        else:
            next_id = step.next_step_id

        if next_id:
            return self.get_step(workflow_id, next_id)

        steps = self._steps.get(workflow_id, [])
        for i, s in enumerate(steps):
            if s.id == current_step_id and i + 1 < len(steps):
                return steps[i + 1]

        return None

    # Execution methods
    def start_execution(
        self,
        workflow_id: str,
        triggered_by: str,
        trigger_type: TriggerType = TriggerType.MANUAL,
        context: Optional[Dict[str, Any]] = None,
        parent_execution_id: Optional[str] = None,
    ) -> Optional[WorkflowExecution]:
        """Start a new workflow execution."""
        workflow = self._workflows.get(workflow_id)
        if not workflow or workflow.status != WorkflowStatus.ACTIVE:
            return None

        execution_id = str(uuid.uuid4())
        execution = WorkflowExecution(
            id=execution_id,
            workflow_id=workflow_id,
            triggered_by=triggered_by,
            trigger_type=trigger_type,
            context=context or {},
            parent_execution_id=parent_execution_id,
        )

        self._executions[workflow_id].append(execution)
        self._step_executions[execution_id] = []

        first_step = self.get_first_step(workflow_id)
        if first_step:
            execution.current_step_id = first_step.id

        execution.start()

        return execution

    def get_execution(self, execution_id: str) -> Optional[WorkflowExecution]:
        """Get an execution by ID."""
        for executions in self._executions.values():
            for e in executions:
                if e.id == execution_id:
                    return e
        return None

    def complete_execution(self, execution_id: str) -> Optional[WorkflowExecution]:
        """Complete an execution."""
        execution = self.get_execution(execution_id)
        if execution:
            execution.complete()
        return execution

    def fail_execution(self, execution_id: str, error: str) -> Optional[WorkflowExecution]:
        """Fail an execution."""
        execution = self.get_execution(execution_id)
        if execution:
            execution.fail(error)
        return execution

    def cancel_execution(self, execution_id: str) -> Optional[WorkflowExecution]:
        """Cancel an execution."""
        execution = self.get_execution(execution_id)
        if execution:
            execution.cancel()
        return execution

    def get_executions(
        self,
        workflow_id: str,
        status: Optional[ExecutionStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[WorkflowExecution]:
        """Get executions for a workflow."""
        executions = self._executions.get(workflow_id, [])

        if status:
            executions = [e for e in executions if e.status == status]

        executions.sort(key=lambda e: e.started_at, reverse=True)
        return executions[offset:offset + limit]

    # Step execution methods
    def start_step_execution(
        self,
        execution_id: str,
        step_id: str,
        input_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[StepExecution]:
        """Start execution of a step."""
        execution = self.get_execution(execution_id)
        if not execution:
            return None

        step_exec_id = str(uuid.uuid4())
        step_execution = StepExecution(
            id=step_exec_id,
            execution_id=execution_id,
            step_id=step_id,
            input_data=input_data or {},
        )

        if execution_id not in self._step_executions:
            self._step_executions[execution_id] = []

        self._step_executions[execution_id].append(step_execution)
        step_execution.start()
        execution.current_step_id = step_id

        return step_execution

    def complete_step_execution(
        self,
        step_execution_id: str,
        output: Optional[Dict[str, Any]] = None,
    ) -> Optional[StepExecution]:
        """Complete a step execution."""
        for step_execs in self._step_executions.values():
            for se in step_execs:
                if se.id == step_execution_id:
                    se.complete(output)
                    return se
        return None

    def fail_step_execution(self, step_execution_id: str, error: str) -> Optional[StepExecution]:
        """Fail a step execution."""
        for step_execs in self._step_executions.values():
            for se in step_execs:
                if se.id == step_execution_id:
                    se.fail(error)
                    return se
        return None

    def get_step_executions(self, execution_id: str) -> List[StepExecution]:
        """Get all step executions for an execution."""
        return self._step_executions.get(execution_id, [])

    # Approval methods
    def create_approval_request(
        self,
        execution_id: str,
        step_id: str,
        requester_id: str,
        approvers: List[str],
        title: str,
        description: str = "",
        approval_type: ApprovalType = ApprovalType.SINGLE,
        required_approvals: int = 1,
        timeout_hours: int = 72,
        data: Optional[Dict[str, Any]] = None,
    ) -> ApprovalRequest:
        """Create an approval request."""
        request_id = str(uuid.uuid4())
        due_at = datetime.utcnow() + timedelta(hours=timeout_hours)

        request = ApprovalRequest(
            id=request_id,
            execution_id=execution_id,
            step_id=step_id,
            requester_id=requester_id,
            approvers=approvers,
            title=title,
            description=description,
            approval_type=approval_type,
            required_approvals=required_approvals,
            due_at=due_at,
            data=data or {},
        )

        self._approval_requests[request_id] = request

        execution = self.get_execution(execution_id)
        if execution:
            execution.wait()

        return request

    def get_approval_request(self, request_id: str) -> Optional[ApprovalRequest]:
        """Get an approval request by ID."""
        return self._approval_requests.get(request_id)

    def approve_request(self, request_id: str, approver_id: str, comment: str = "") -> bool:
        """Approve a request."""
        request = self._approval_requests.get(request_id)
        if not request:
            return False
        return request.approve(approver_id, comment)

    def reject_request(self, request_id: str, approver_id: str, comment: str = "") -> bool:
        """Reject a request."""
        request = self._approval_requests.get(request_id)
        if not request:
            return False
        return request.reject(approver_id, comment)

    def delegate_approval(
        self,
        request_id: str,
        from_user_id: str,
        to_user_id: str,
        comment: str = "",
    ) -> bool:
        """Delegate an approval."""
        request = self._approval_requests.get(request_id)
        if not request:
            return False
        return request.delegate(from_user_id, to_user_id, comment)

    def get_pending_approvals(
        self,
        approver_id: Optional[str] = None,
        requester_id: Optional[str] = None,
    ) -> List[ApprovalRequest]:
        """Get pending approval requests."""
        requests = [
            r for r in self._approval_requests.values()
            if r.status == ApprovalStatus.PENDING
        ]

        if approver_id:
            requests = [r for r in requests if approver_id in r.approvers]
        if requester_id:
            requests = [r for r in requests if r.requester_id == requester_id]

        return requests

    def get_approvals_for_execution(self, execution_id: str) -> List[ApprovalRequest]:
        """Get all approval requests for an execution."""
        return [
            r for r in self._approval_requests.values()
            if r.execution_id == execution_id
        ]

    # Action handlers
    def register_action_handler(self, action_type: ActionType, handler: Callable) -> None:
        """Register a handler for an action type."""
        self._action_handlers[action_type] = handler

    def execute_action(
        self,
        action: WorkflowAction,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute an action."""
        handler = self._action_handlers.get(action.action_type)
        if handler:
            try:
                return handler(action, context)
            except Exception as e:
                return {"success": False, "error": str(e)}

        if action.action_type == ActionType.SET_VARIABLE:
            return {
                "success": True,
                "variable": action.config.get("name"),
                "value": action.config.get("value"),
            }

        if action.action_type == ActionType.LOG_MESSAGE:
            return {
                "success": True,
                "message": action.config.get("message", ""),
            }

        return {"success": True, "action_type": action.action_type.value}

    # Template methods
    def create_template(
        self,
        name: str,
        created_by: str,
        workflow_type: WorkflowType = WorkflowType.AUTOMATION,
        description: str = "",
        category: str = "",
        steps_config: Optional[List[Dict[str, Any]]] = None,
        triggers_config: Optional[List[Dict[str, Any]]] = None,
    ) -> WorkflowTemplate:
        """Create a workflow template."""
        template_id = str(uuid.uuid4())
        template = WorkflowTemplate(
            id=template_id,
            name=name,
            description=description,
            workflow_type=workflow_type,
            category=category,
            steps_config=steps_config or [],
            triggers_config=triggers_config or [],
            created_by=created_by,
        )

        self._templates[template_id] = template
        return template

    def get_template(self, template_id: str) -> Optional[WorkflowTemplate]:
        """Get a template by ID."""
        return self._templates.get(template_id)

    def list_templates(
        self,
        workflow_type: Optional[WorkflowType] = None,
        category: Optional[str] = None,
    ) -> List[WorkflowTemplate]:
        """List templates."""
        templates = list(self._templates.values())

        if workflow_type:
            templates = [t for t in templates if t.workflow_type == workflow_type]
        if category:
            templates = [t for t in templates if t.category == category]

        return templates

    def create_workflow_from_template(
        self,
        template_id: str,
        name: str,
        creator_id: str,
        workspace_id: Optional[str] = None,
    ) -> Optional[Workflow]:
        """Create a workflow from a template."""
        template = self._templates.get(template_id)
        if not template:
            return None

        workflow = self.create_workflow(
            name=name,
            creator_id=creator_id,
            workflow_type=template.workflow_type,
            description=template.description,
            workspace_id=workspace_id,
        )

        for trigger_config in template.triggers_config:
            self.add_trigger(
                workflow_id=workflow.id,
                trigger_type=TriggerType(trigger_config.get("trigger_type", "manual")),
                name=trigger_config.get("name", ""),
                event_type=trigger_config.get("event_type", ""),
                conditions=trigger_config.get("conditions"),
            )

        for step_config in template.steps_config:
            action = None
            if step_config.get("action"):
                action_config = step_config["action"]
                action = WorkflowAction(
                    id=str(uuid.uuid4()),
                    action_type=ActionType(action_config.get("action_type", "log_message")),
                    name=action_config.get("name", ""),
                    config=action_config.get("config", {}),
                )

            self.add_step(
                workflow_id=workflow.id,
                step_type=StepType(step_config.get("step_type", "action")),
                name=step_config.get("name", ""),
                action=action,
                delay_seconds=step_config.get("delay_seconds", 0),
            )

        return workflow

    def delete_template(self, template_id: str) -> bool:
        """Delete a template."""
        if template_id in self._templates:
            del self._templates[template_id]
            return True
        return False

    # Statistics
    def get_stats(
        self,
        workspace_id: Optional[str] = None,
        creator_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get workflow statistics."""
        workflows = self.list_workflows(workspace_id=workspace_id, creator_id=creator_id)

        total_executions = 0
        completed_executions = 0
        failed_executions = 0

        for workflow in workflows:
            executions = self._executions.get(workflow.id, [])
            total_executions += len(executions)
            completed_executions += len([e for e in executions if e.status == ExecutionStatus.COMPLETED])
            failed_executions += len([e for e in executions if e.status == ExecutionStatus.FAILED])

        status_counts = {}
        for status in WorkflowStatus:
            status_counts[status.value] = len([w for w in workflows if w.status == status])

        pending_approvals = len([
            r for r in self._approval_requests.values()
            if r.status == ApprovalStatus.PENDING
        ])

        return {
            "total_workflows": len(workflows),
            "total_executions": total_executions,
            "completed_executions": completed_executions,
            "failed_executions": failed_executions,
            "workflows_by_status": status_counts,
            "active_workflows": status_counts.get(WorkflowStatus.ACTIVE.value, 0),
            "pending_approvals": pending_approvals,
        }


class WorkflowManager:
    """High-level API for workflow operations."""

    def __init__(self, registry: Optional[WorkflowRegistry] = None) -> None:
        """Initialize the manager."""
        self._registry = registry or WorkflowRegistry()

    @property
    def registry(self) -> WorkflowRegistry:
        """Get the registry."""
        return self._registry

    # Workflow methods
    def create_workflow(
        self,
        name: str,
        creator_id: str,
        workflow_type: WorkflowType = WorkflowType.AUTOMATION,
        description: str = "",
        workspace_id: Optional[str] = None,
        tags: Optional[Set[str]] = None,
    ) -> Workflow:
        """Create a new workflow."""
        return self._registry.create_workflow(
            name=name,
            creator_id=creator_id,
            workflow_type=workflow_type,
            description=description,
            workspace_id=workspace_id,
            tags=tags,
        )

    def create_approval_workflow(
        self,
        name: str,
        creator_id: str,
        approvers: List[str],
        approval_type: ApprovalType = ApprovalType.SINGLE,
        description: str = "",
        workspace_id: Optional[str] = None,
    ) -> Workflow:
        """Create an approval workflow."""
        workflow = self._registry.create_workflow(
            name=name,
            creator_id=creator_id,
            workflow_type=WorkflowType.APPROVAL,
            description=description,
            workspace_id=workspace_id,
        )

        self._registry.add_trigger(
            workflow_id=workflow.id,
            trigger_type=TriggerType.MANUAL,
            name="Manual Trigger",
        )

        approval_step = ApprovalStep(
            id=str(uuid.uuid4()),
            name="Approval",
            approvers=approvers,
            approval_type=approval_type,
        )

        self._registry.add_step(
            workflow_id=workflow.id,
            step_type=StepType.APPROVAL,
            name="Request Approval",
            approval_step=approval_step,
        )

        return workflow

    def create_notification_workflow(
        self,
        name: str,
        creator_id: str,
        event_type: str,
        notification_config: Dict[str, Any],
        workspace_id: Optional[str] = None,
    ) -> Workflow:
        """Create a notification workflow."""
        workflow = self._registry.create_workflow(
            name=name,
            creator_id=creator_id,
            workflow_type=WorkflowType.NOTIFICATION,
            workspace_id=workspace_id,
        )

        self._registry.add_trigger(
            workflow_id=workflow.id,
            trigger_type=TriggerType.EVENT,
            name=f"On {event_type}",
            event_type=event_type,
        )

        action = WorkflowAction(
            id=str(uuid.uuid4()),
            action_type=ActionType.SEND_NOTIFICATION,
            name="Send Notification",
            config=notification_config,
        )

        self._registry.add_step(
            workflow_id=workflow.id,
            step_type=StepType.ACTION,
            name="Send Notification",
            action=action,
        )

        return workflow

    def create_scheduled_workflow(
        self,
        name: str,
        creator_id: str,
        schedule_cron: str,
        workspace_id: Optional[str] = None,
    ) -> Workflow:
        """Create a scheduled workflow."""
        workflow = self._registry.create_workflow(
            name=name,
            creator_id=creator_id,
            workflow_type=WorkflowType.AUTOMATION,
            workspace_id=workspace_id,
        )

        self._registry.add_trigger(
            workflow_id=workflow.id,
            trigger_type=TriggerType.SCHEDULE,
            name="Scheduled Trigger",
            schedule_cron=schedule_cron,
        )

        return workflow

    def get_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Get a workflow."""
        return self._registry.get_workflow(workflow_id)

    def update_workflow(
        self,
        workflow_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Optional[Workflow]:
        """Update a workflow."""
        return self._registry.update_workflow(workflow_id, name, description)

    def delete_workflow(self, workflow_id: str) -> bool:
        """Delete a workflow."""
        return self._registry.delete_workflow(workflow_id)

    def activate_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Activate a workflow."""
        return self._registry.activate_workflow(workflow_id)

    def pause_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Pause a workflow."""
        return self._registry.pause_workflow(workflow_id)

    def list_workflows(
        self,
        creator_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        workflow_type: Optional[WorkflowType] = None,
        status: Optional[WorkflowStatus] = None,
    ) -> List[Workflow]:
        """List workflows."""
        return self._registry.list_workflows(
            creator_id=creator_id,
            workspace_id=workspace_id,
            workflow_type=workflow_type,
            status=status,
        )

    # Trigger methods
    def add_trigger(
        self,
        workflow_id: str,
        trigger_type: TriggerType,
        name: str = "",
        event_type: str = "",
        conditions: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[WorkflowTrigger]:
        """Add a trigger."""
        return self._registry.add_trigger(
            workflow_id=workflow_id,
            trigger_type=trigger_type,
            name=name,
            event_type=event_type,
            conditions=conditions,
        )

    def add_event_trigger(
        self,
        workflow_id: str,
        event_type: str,
        conditions: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[WorkflowTrigger]:
        """Add an event trigger."""
        return self.add_trigger(
            workflow_id=workflow_id,
            trigger_type=TriggerType.EVENT,
            name=f"On {event_type}",
            event_type=event_type,
            conditions=conditions,
        )

    def add_schedule_trigger(
        self,
        workflow_id: str,
        schedule_cron: str,
        name: str = "Scheduled",
    ) -> Optional[WorkflowTrigger]:
        """Add a schedule trigger."""
        return self._registry.add_trigger(
            workflow_id=workflow_id,
            trigger_type=TriggerType.SCHEDULE,
            name=name,
            schedule_cron=schedule_cron,
        )

    def get_triggers(self, workflow_id: str) -> List[WorkflowTrigger]:
        """Get triggers for a workflow."""
        return self._registry.get_triggers(workflow_id)

    # Step methods
    def add_action_step(
        self,
        workflow_id: str,
        name: str,
        action_type: ActionType,
        config: Optional[Dict[str, Any]] = None,
    ) -> Optional[WorkflowStep]:
        """Add an action step."""
        action = WorkflowAction(
            id=str(uuid.uuid4()),
            action_type=action_type,
            name=name,
            config=config or {},
        )

        return self._registry.add_step(
            workflow_id=workflow_id,
            step_type=StepType.ACTION,
            name=name,
            action=action,
        )

    def add_condition_step(
        self,
        workflow_id: str,
        name: str,
        field: str,
        operator: ConditionOperator,
        value: Any,
        on_true_step_id: Optional[str] = None,
        on_false_step_id: Optional[str] = None,
    ) -> Optional[WorkflowStep]:
        """Add a condition step."""
        condition = WorkflowCondition(
            id=str(uuid.uuid4()),
            field=field,
            operator=operator,
            value=value,
        )

        step = self._registry.add_step(
            workflow_id=workflow_id,
            step_type=StepType.CONDITION,
            name=name,
            conditions=[condition],
        )

        if step:
            step.on_true_step_id = on_true_step_id
            step.on_false_step_id = on_false_step_id

        return step

    def add_delay_step(
        self,
        workflow_id: str,
        name: str,
        delay_seconds: int,
    ) -> Optional[WorkflowStep]:
        """Add a delay step."""
        return self._registry.add_step(
            workflow_id=workflow_id,
            step_type=StepType.DELAY,
            name=name,
            delay_seconds=delay_seconds,
        )

    def add_approval_step(
        self,
        workflow_id: str,
        name: str,
        approvers: List[str],
        approval_type: ApprovalType = ApprovalType.SINGLE,
        timeout_hours: int = 72,
    ) -> Optional[WorkflowStep]:
        """Add an approval step."""
        approval_step = ApprovalStep(
            id=str(uuid.uuid4()),
            name=name,
            approvers=approvers,
            approval_type=approval_type,
            timeout_hours=timeout_hours,
        )

        return self._registry.add_step(
            workflow_id=workflow_id,
            step_type=StepType.APPROVAL,
            name=name,
            approval_step=approval_step,
        )

    def get_steps(self, workflow_id: str) -> List[WorkflowStep]:
        """Get steps for a workflow."""
        return self._registry.get_steps(workflow_id)

    def update_step(
        self,
        workflow_id: str,
        step_id: str,
        name: Optional[str] = None,
        is_enabled: Optional[bool] = None,
    ) -> Optional[WorkflowStep]:
        """Update a step."""
        return self._registry.update_step(workflow_id, step_id, name, is_enabled)

    def delete_step(self, workflow_id: str, step_id: str) -> bool:
        """Delete a step."""
        return self._registry.delete_step(workflow_id, step_id)

    def link_steps(
        self,
        workflow_id: str,
        from_step_id: str,
        to_step_id: str,
    ) -> bool:
        """Link two steps."""
        step = self._registry.update_step(
            workflow_id, from_step_id, next_step_id=to_step_id
        )
        return step is not None

    # Execution methods
    def execute_workflow(
        self,
        workflow_id: str,
        triggered_by: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Optional[WorkflowExecution]:
        """Execute a workflow manually."""
        return self._registry.start_execution(
            workflow_id=workflow_id,
            triggered_by=triggered_by,
            trigger_type=TriggerType.MANUAL,
            context=context,
        )

    def trigger_workflow(
        self,
        workflow_id: str,
        event_type: str,
        event_data: Dict[str, Any],
        triggered_by: str,
    ) -> Optional[WorkflowExecution]:
        """Trigger a workflow by event."""
        workflow = self._registry.get_workflow(workflow_id)
        if not workflow or workflow.status != WorkflowStatus.ACTIVE:
            return None

        triggers = self._registry.get_triggers(workflow_id)
        for trigger in triggers:
            if trigger.trigger_type == TriggerType.EVENT and trigger.event_type == event_type:
                if trigger.should_trigger(event_data):
                    trigger.last_triggered_at = datetime.utcnow()
                    return self._registry.start_execution(
                        workflow_id=workflow_id,
                        triggered_by=triggered_by,
                        trigger_type=TriggerType.EVENT,
                        context=event_data,
                    )

        return None

    def get_execution(self, execution_id: str) -> Optional[WorkflowExecution]:
        """Get an execution."""
        return self._registry.get_execution(execution_id)

    def cancel_execution(self, execution_id: str) -> Optional[WorkflowExecution]:
        """Cancel an execution."""
        return self._registry.cancel_execution(execution_id)

    def get_executions(
        self,
        workflow_id: str,
        status: Optional[ExecutionStatus] = None,
    ) -> List[WorkflowExecution]:
        """Get executions for a workflow."""
        return self._registry.get_executions(workflow_id, status)

    def run_step(
        self,
        execution_id: str,
        step_id: str,
    ) -> Optional[StepExecution]:
        """Run a specific step."""
        execution = self._registry.get_execution(execution_id)
        if not execution:
            return None

        step = self._registry.get_step(execution.workflow_id, step_id)
        if not step or not step.is_enabled:
            return None

        step_execution = self._registry.start_step_execution(
            execution_id=execution_id,
            step_id=step_id,
            input_data={"context": execution.context, "variables": execution.variables},
        )

        if not step_execution:
            return None

        try:
            if step.step_type == StepType.ACTION and step.action:
                result = self._registry.execute_action(step.action, execution.context)
                if result.get("variable"):
                    execution.set_variable(result["variable"], result.get("value"))
                self._registry.complete_step_execution(step_execution.id, result)

            elif step.step_type == StepType.CONDITION:
                result = step.evaluate_conditions(execution.context)
                self._registry.complete_step_execution(
                    step_execution.id, {"condition_result": result}
                )

            elif step.step_type == StepType.DELAY:
                execution.wait()
                self._registry.complete_step_execution(
                    step_execution.id, {"delayed_seconds": step.delay_seconds}
                )

            elif step.step_type == StepType.APPROVAL and step.approval_step:
                request = self._registry.create_approval_request(
                    execution_id=execution_id,
                    step_id=step_id,
                    requester_id=execution.triggered_by,
                    approvers=step.approval_step.approvers,
                    title=step.name,
                    description=step.description,
                    approval_type=step.approval_step.approval_type,
                    timeout_hours=step.approval_step.timeout_hours,
                    data=execution.context,
                )
                self._registry.complete_step_execution(
                    step_execution.id, {"approval_request_id": request.id}
                )

            else:
                self._registry.complete_step_execution(step_execution.id)

        except Exception as e:
            self._registry.fail_step_execution(step_execution.id, str(e))

        return step_execution

    def get_step_executions(self, execution_id: str) -> List[StepExecution]:
        """Get step executions."""
        return self._registry.get_step_executions(execution_id)

    # Approval methods
    def create_approval_request(
        self,
        execution_id: str,
        step_id: str,
        requester_id: str,
        approvers: List[str],
        title: str,
        description: str = "",
    ) -> ApprovalRequest:
        """Create an approval request."""
        return self._registry.create_approval_request(
            execution_id=execution_id,
            step_id=step_id,
            requester_id=requester_id,
            approvers=approvers,
            title=title,
            description=description,
        )

    def approve(self, request_id: str, approver_id: str, comment: str = "") -> bool:
        """Approve a request."""
        result = self._registry.approve_request(request_id, approver_id, comment)

        if result:
            request = self._registry.get_approval_request(request_id)
            if request and request.status == ApprovalStatus.APPROVED:
                execution = self._registry.get_execution(request.execution_id)
                if execution:
                    execution.status = ExecutionStatus.RUNNING

        return result

    def reject(self, request_id: str, approver_id: str, comment: str = "") -> bool:
        """Reject a request."""
        result = self._registry.reject_request(request_id, approver_id, comment)

        if result:
            request = self._registry.get_approval_request(request_id)
            if request:
                self._registry.fail_execution(
                    request.execution_id,
                    f"Approval rejected by {approver_id}"
                )

        return result

    def delegate_approval(
        self,
        request_id: str,
        from_user_id: str,
        to_user_id: str,
    ) -> bool:
        """Delegate an approval."""
        return self._registry.delegate_approval(request_id, from_user_id, to_user_id)

    def get_pending_approvals(
        self,
        approver_id: Optional[str] = None,
    ) -> List[ApprovalRequest]:
        """Get pending approvals."""
        return self._registry.get_pending_approvals(approver_id=approver_id)

    def get_approval_request(self, request_id: str) -> Optional[ApprovalRequest]:
        """Get an approval request."""
        return self._registry.get_approval_request(request_id)

    # Template methods
    def create_template(
        self,
        name: str,
        created_by: str,
        workflow_type: WorkflowType = WorkflowType.AUTOMATION,
        steps_config: Optional[List[Dict[str, Any]]] = None,
    ) -> WorkflowTemplate:
        """Create a template."""
        return self._registry.create_template(
            name=name,
            created_by=created_by,
            workflow_type=workflow_type,
            steps_config=steps_config,
        )

    def save_workflow_as_template(
        self,
        workflow_id: str,
        template_name: str,
        created_by: str,
    ) -> Optional[WorkflowTemplate]:
        """Save a workflow as a template."""
        workflow = self._registry.get_workflow(workflow_id)
        if not workflow:
            return None

        steps = self._registry.get_steps(workflow_id)
        triggers = self._registry.get_triggers(workflow_id)

        steps_config = [s.to_dict() for s in steps]
        triggers_config = [t.to_dict() for t in triggers]

        return self._registry.create_template(
            name=template_name,
            created_by=created_by,
            workflow_type=workflow.workflow_type,
            description=workflow.description,
            steps_config=steps_config,
            triggers_config=triggers_config,
        )

    def get_template(self, template_id: str) -> Optional[WorkflowTemplate]:
        """Get a template."""
        return self._registry.get_template(template_id)

    def list_templates(
        self,
        workflow_type: Optional[WorkflowType] = None,
    ) -> List[WorkflowTemplate]:
        """List templates."""
        return self._registry.list_templates(workflow_type=workflow_type)

    def create_workflow_from_template(
        self,
        template_id: str,
        name: str,
        creator_id: str,
    ) -> Optional[Workflow]:
        """Create a workflow from a template."""
        return self._registry.create_workflow_from_template(template_id, name, creator_id)

    def delete_template(self, template_id: str) -> bool:
        """Delete a template."""
        return self._registry.delete_template(template_id)

    # Statistics
    def get_workflow_summary(self, workflow_id: str) -> Dict[str, Any]:
        """Get workflow summary."""
        workflow = self._registry.get_workflow(workflow_id)
        if not workflow:
            return {}

        steps = self._registry.get_steps(workflow_id)
        triggers = self._registry.get_triggers(workflow_id)
        executions = self._registry.get_executions(workflow_id)

        completed = len([e for e in executions if e.status == ExecutionStatus.COMPLETED])
        failed = len([e for e in executions if e.status == ExecutionStatus.FAILED])

        return {
            "workflow": workflow.to_dict(),
            "step_count": len(steps),
            "trigger_count": len(triggers),
            "total_executions": len(executions),
            "completed_executions": completed,
            "failed_executions": failed,
            "success_rate": (completed / len(executions) * 100) if executions else 0,
        }

    def get_stats(
        self,
        workspace_id: Optional[str] = None,
        creator_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get overall statistics."""
        return self._registry.get_stats(workspace_id, creator_id)


# Global instance management
_workflow_manager: Optional[WorkflowManager] = None


def get_workflow_manager() -> WorkflowManager:
    """Get the global workflow manager instance."""
    global _workflow_manager
    if _workflow_manager is None:
        _workflow_manager = WorkflowManager()
    return _workflow_manager


def set_workflow_manager(manager: WorkflowManager) -> None:
    """Set the global workflow manager instance."""
    global _workflow_manager
    _workflow_manager = manager


def reset_workflow_manager() -> None:
    """Reset the global workflow manager instance."""
    global _workflow_manager
    _workflow_manager = None
