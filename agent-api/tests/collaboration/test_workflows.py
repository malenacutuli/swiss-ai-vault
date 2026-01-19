"""
Tests for the Workflow Automation module.
"""

import pytest
from datetime import datetime, timedelta
from typing import Dict, Any

from app.collaboration.workflows import (
    WorkflowManager,
    WorkflowRegistry,
    Workflow,
    WorkflowStatus,
    WorkflowType,
    WorkflowTrigger,
    TriggerType,
    WorkflowStep,
    StepType,
    WorkflowAction,
    ActionType,
    WorkflowCondition,
    ConditionOperator,
    WorkflowExecution,
    ExecutionStatus,
    StepExecution,
    ApprovalRequest,
    ApprovalStatus,
    ApprovalType,
    ApprovalStep,
    WorkflowTemplate,
    get_workflow_manager,
    set_workflow_manager,
    reset_workflow_manager,
)


# ============================================================
# Enum Tests
# ============================================================

class TestWorkflowEnums:
    """Test workflow enumeration types."""

    def test_workflow_status_values(self) -> None:
        """Test WorkflowStatus enum values."""
        assert WorkflowStatus.DRAFT.value == "draft"
        assert WorkflowStatus.ACTIVE.value == "active"
        assert WorkflowStatus.PAUSED.value == "paused"
        assert WorkflowStatus.ARCHIVED.value == "archived"

    def test_workflow_type_values(self) -> None:
        """Test WorkflowType enum values."""
        assert WorkflowType.AUTOMATION.value == "automation"
        assert WorkflowType.APPROVAL.value == "approval"
        assert WorkflowType.NOTIFICATION.value == "notification"
        assert WorkflowType.INTEGRATION.value == "integration"

    def test_trigger_type_values(self) -> None:
        """Test TriggerType enum values."""
        assert TriggerType.MANUAL.value == "manual"
        assert TriggerType.SCHEDULE.value == "schedule"
        assert TriggerType.EVENT.value == "event"
        assert TriggerType.WEBHOOK.value == "webhook"

    def test_step_type_values(self) -> None:
        """Test StepType enum values."""
        assert StepType.ACTION.value == "action"
        assert StepType.CONDITION.value == "condition"
        assert StepType.DELAY.value == "delay"
        assert StepType.APPROVAL.value == "approval"

    def test_action_type_values(self) -> None:
        """Test ActionType enum values."""
        assert ActionType.SEND_NOTIFICATION.value == "send_notification"
        assert ActionType.UPDATE_FIELD.value == "update_field"
        assert ActionType.CREATE_TASK.value == "create_task"
        assert ActionType.CALL_WEBHOOK.value == "call_webhook"

    def test_execution_status_values(self) -> None:
        """Test ExecutionStatus enum values."""
        assert ExecutionStatus.PENDING.value == "pending"
        assert ExecutionStatus.RUNNING.value == "running"
        assert ExecutionStatus.COMPLETED.value == "completed"
        assert ExecutionStatus.FAILED.value == "failed"

    def test_approval_status_values(self) -> None:
        """Test ApprovalStatus enum values."""
        assert ApprovalStatus.PENDING.value == "pending"
        assert ApprovalStatus.APPROVED.value == "approved"
        assert ApprovalStatus.REJECTED.value == "rejected"
        assert ApprovalStatus.ESCALATED.value == "escalated"


# ============================================================
# WorkflowTrigger Tests
# ============================================================

class TestWorkflowTrigger:
    """Test WorkflowTrigger dataclass."""

    def test_create_trigger(self) -> None:
        """Test creating a trigger."""
        trigger = WorkflowTrigger(
            id="trigger1",
            trigger_type=TriggerType.EVENT,
            name="On Task Created",
            event_type="task.created",
        )
        assert trigger.id == "trigger1"
        assert trigger.trigger_type == TriggerType.EVENT
        assert trigger.is_enabled is True

    def test_trigger_should_trigger_no_conditions(self) -> None:
        """Test trigger without conditions."""
        trigger = WorkflowTrigger(
            id="trigger1",
            trigger_type=TriggerType.EVENT,
        )
        assert trigger.should_trigger({"field": "value"}) is True

    def test_trigger_disabled(self) -> None:
        """Test disabled trigger."""
        trigger = WorkflowTrigger(
            id="trigger1",
            trigger_type=TriggerType.EVENT,
            is_enabled=False,
        )
        assert trigger.should_trigger({}) is False

    def test_trigger_with_conditions(self) -> None:
        """Test trigger with conditions."""
        trigger = WorkflowTrigger(
            id="trigger1",
            trigger_type=TriggerType.EVENT,
            conditions=[
                {"field": "status", "operator": "equals", "value": "open"},
            ],
        )
        assert trigger.should_trigger({"status": "open"}) is True
        assert trigger.should_trigger({"status": "closed"}) is False

    def test_trigger_to_dict(self) -> None:
        """Test trigger to_dict method."""
        trigger = WorkflowTrigger(
            id="trigger1",
            trigger_type=TriggerType.SCHEDULE,
            schedule_cron="0 9 * * *",
        )
        data = trigger.to_dict()
        assert data["id"] == "trigger1"
        assert data["trigger_type"] == "schedule"


# ============================================================
# WorkflowCondition Tests
# ============================================================

class TestWorkflowCondition:
    """Test WorkflowCondition dataclass."""

    def test_equals_condition(self) -> None:
        """Test equals condition."""
        condition = WorkflowCondition(
            id="cond1",
            field="status",
            operator=ConditionOperator.EQUALS,
            value="active",
        )
        assert condition.evaluate({"status": "active"}) is True
        assert condition.evaluate({"status": "inactive"}) is False

    def test_not_equals_condition(self) -> None:
        """Test not equals condition."""
        condition = WorkflowCondition(
            id="cond1",
            field="status",
            operator=ConditionOperator.NOT_EQUALS,
            value="closed",
        )
        assert condition.evaluate({"status": "open"}) is True
        assert condition.evaluate({"status": "closed"}) is False

    def test_contains_string_condition(self) -> None:
        """Test contains condition for strings."""
        condition = WorkflowCondition(
            id="cond1",
            field="title",
            operator=ConditionOperator.CONTAINS,
            value="urgent",
        )
        assert condition.evaluate({"title": "This is urgent"}) is True
        assert condition.evaluate({"title": "Normal task"}) is False

    def test_greater_than_condition(self) -> None:
        """Test greater than condition."""
        condition = WorkflowCondition(
            id="cond1",
            field="priority",
            operator=ConditionOperator.GREATER_THAN,
            value=5,
        )
        assert condition.evaluate({"priority": 10}) is True
        assert condition.evaluate({"priority": 3}) is False

    def test_is_empty_condition(self) -> None:
        """Test is empty condition."""
        condition = WorkflowCondition(
            id="cond1",
            field="assignee",
            operator=ConditionOperator.IS_EMPTY,
            value=None,
        )
        assert condition.evaluate({"assignee": None}) is True
        assert condition.evaluate({"assignee": ""}) is True
        assert condition.evaluate({"assignee": "user1"}) is False

    def test_nested_value(self) -> None:
        """Test nested value access."""
        condition = WorkflowCondition(
            id="cond1",
            field="user.role",
            operator=ConditionOperator.EQUALS,
            value="admin",
        )
        assert condition.evaluate({"user": {"role": "admin"}}) is True
        assert condition.evaluate({"user": {"role": "member"}}) is False

    def test_matches_regex(self) -> None:
        """Test regex matches condition."""
        condition = WorkflowCondition(
            id="cond1",
            field="email",
            operator=ConditionOperator.MATCHES,
            value=r".*@example\.com$",
        )
        assert condition.evaluate({"email": "user@example.com"}) is True
        assert condition.evaluate({"email": "user@other.com"}) is False

    def test_in_list_condition(self) -> None:
        """Test in list condition."""
        condition = WorkflowCondition(
            id="cond1",
            field="status",
            operator=ConditionOperator.IN_LIST,
            value=["open", "in_progress"],
        )
        assert condition.evaluate({"status": "open"}) is True
        assert condition.evaluate({"status": "closed"}) is False


# ============================================================
# WorkflowAction Tests
# ============================================================

class TestWorkflowAction:
    """Test WorkflowAction dataclass."""

    def test_create_action(self) -> None:
        """Test creating an action."""
        action = WorkflowAction(
            id="action1",
            action_type=ActionType.SEND_NOTIFICATION,
            name="Send Alert",
            config={"message": "Task completed"},
        )
        assert action.id == "action1"
        assert action.action_type == ActionType.SEND_NOTIFICATION
        assert action.config["message"] == "Task completed"

    def test_action_defaults(self) -> None:
        """Test action default values."""
        action = WorkflowAction(
            id="action1",
            action_type=ActionType.LOG_MESSAGE,
        )
        assert action.retry_count == 0
        assert action.timeout_seconds == 300
        assert action.on_error == "fail"

    def test_action_to_dict(self) -> None:
        """Test action to_dict method."""
        action = WorkflowAction(
            id="action1",
            action_type=ActionType.UPDATE_FIELD,
            config={"field": "status", "value": "complete"},
        )
        data = action.to_dict()
        assert data["action_type"] == "update_field"
        assert data["config"]["field"] == "status"


# ============================================================
# ApprovalStep Tests
# ============================================================

class TestApprovalStep:
    """Test ApprovalStep dataclass."""

    def test_create_approval_step(self) -> None:
        """Test creating an approval step."""
        step = ApprovalStep(
            id="approval1",
            name="Manager Approval",
            approvers=["user1", "user2"],
            approval_type=ApprovalType.SINGLE,
        )
        assert step.id == "approval1"
        assert len(step.approvers) == 2
        assert step.timeout_hours == 72

    def test_approval_step_to_dict(self) -> None:
        """Test approval step to_dict method."""
        step = ApprovalStep(
            id="approval1",
            name="Review",
            approvers=["user1"],
        )
        data = step.to_dict()
        assert data["name"] == "Review"
        assert data["approval_type"] == "single"


# ============================================================
# WorkflowStep Tests
# ============================================================

class TestWorkflowStep:
    """Test WorkflowStep dataclass."""

    def test_create_step(self) -> None:
        """Test creating a workflow step."""
        step = WorkflowStep(
            id="step1",
            workflow_id="wf1",
            step_type=StepType.ACTION,
            name="Send Email",
        )
        assert step.id == "step1"
        assert step.step_type == StepType.ACTION
        assert step.is_enabled is True

    def test_step_evaluate_conditions_empty(self) -> None:
        """Test step with no conditions."""
        step = WorkflowStep(
            id="step1",
            workflow_id="wf1",
            step_type=StepType.ACTION,
            name="Step",
        )
        assert step.evaluate_conditions({}) is True

    def test_step_evaluate_conditions(self) -> None:
        """Test step condition evaluation."""
        step = WorkflowStep(
            id="step1",
            workflow_id="wf1",
            step_type=StepType.CONDITION,
            name="Check Status",
            conditions=[
                WorkflowCondition(
                    id="c1",
                    field="status",
                    operator=ConditionOperator.EQUALS,
                    value="active",
                )
            ],
        )
        assert step.evaluate_conditions({"status": "active"}) is True
        assert step.evaluate_conditions({"status": "inactive"}) is False

    def test_step_to_dict(self) -> None:
        """Test step to_dict method."""
        action = WorkflowAction(
            id="a1",
            action_type=ActionType.LOG_MESSAGE,
            config={"message": "test"},
        )
        step = WorkflowStep(
            id="step1",
            workflow_id="wf1",
            step_type=StepType.ACTION,
            name="Log",
            action=action,
        )
        data = step.to_dict()
        assert data["step_type"] == "action"
        assert data["action"]["action_type"] == "log_message"


# ============================================================
# Workflow Tests
# ============================================================

class TestWorkflow:
    """Test Workflow dataclass."""

    def test_create_workflow(self) -> None:
        """Test creating a workflow."""
        workflow = Workflow(
            id="wf1",
            name="My Workflow",
            creator_id="user1",
        )
        assert workflow.id == "wf1"
        assert workflow.status == WorkflowStatus.DRAFT
        assert workflow.version == 1

    def test_workflow_activate(self) -> None:
        """Test activating a workflow."""
        workflow = Workflow(id="wf1", name="Workflow", creator_id="user1")
        workflow.activate()
        assert workflow.status == WorkflowStatus.ACTIVE
        assert workflow.activated_at is not None

    def test_workflow_pause(self) -> None:
        """Test pausing a workflow."""
        workflow = Workflow(id="wf1", name="Workflow", creator_id="user1")
        workflow.activate()
        workflow.pause()
        assert workflow.status == WorkflowStatus.PAUSED

    def test_workflow_archive(self) -> None:
        """Test archiving a workflow."""
        workflow = Workflow(id="wf1", name="Workflow", creator_id="user1")
        workflow.archive()
        assert workflow.status == WorkflowStatus.ARCHIVED

    def test_workflow_to_dict(self) -> None:
        """Test workflow to_dict method."""
        workflow = Workflow(
            id="wf1",
            name="My Workflow",
            creator_id="user1",
            description="Test workflow",
            tags={"automation", "hr"},
        )
        data = workflow.to_dict()
        assert data["id"] == "wf1"
        assert data["name"] == "My Workflow"
        assert set(data["tags"]) == {"automation", "hr"}


# ============================================================
# StepExecution Tests
# ============================================================

class TestStepExecution:
    """Test StepExecution dataclass."""

    def test_create_step_execution(self) -> None:
        """Test creating a step execution."""
        step_exec = StepExecution(
            id="se1",
            execution_id="exec1",
            step_id="step1",
        )
        assert step_exec.status == ExecutionStatus.PENDING
        assert step_exec.started_at is None

    def test_step_execution_start(self) -> None:
        """Test starting step execution."""
        step_exec = StepExecution(id="se1", execution_id="exec1", step_id="step1")
        step_exec.start()
        assert step_exec.status == ExecutionStatus.RUNNING
        assert step_exec.started_at is not None

    def test_step_execution_complete(self) -> None:
        """Test completing step execution."""
        step_exec = StepExecution(id="se1", execution_id="exec1", step_id="step1")
        step_exec.start()
        step_exec.complete({"result": "success"})
        assert step_exec.status == ExecutionStatus.COMPLETED
        assert step_exec.output_data["result"] == "success"
        assert step_exec.duration_ms >= 0  # Can be 0 if instantaneous

    def test_step_execution_fail(self) -> None:
        """Test failing step execution."""
        step_exec = StepExecution(id="se1", execution_id="exec1", step_id="step1")
        step_exec.start()
        step_exec.fail("Connection timeout")
        assert step_exec.status == ExecutionStatus.FAILED
        assert step_exec.error_message == "Connection timeout"


# ============================================================
# WorkflowExecution Tests
# ============================================================

class TestWorkflowExecution:
    """Test WorkflowExecution dataclass."""

    def test_create_execution(self) -> None:
        """Test creating an execution."""
        execution = WorkflowExecution(
            id="exec1",
            workflow_id="wf1",
            triggered_by="user1",
        )
        assert execution.status == ExecutionStatus.PENDING
        assert execution.triggered_by == "user1"

    def test_execution_start(self) -> None:
        """Test starting execution."""
        execution = WorkflowExecution(id="exec1", workflow_id="wf1")
        execution.start()
        assert execution.status == ExecutionStatus.RUNNING

    def test_execution_complete(self) -> None:
        """Test completing execution."""
        execution = WorkflowExecution(id="exec1", workflow_id="wf1")
        execution.start()
        execution.complete()
        assert execution.status == ExecutionStatus.COMPLETED
        assert execution.completed_at is not None

    def test_execution_fail(self) -> None:
        """Test failing execution."""
        execution = WorkflowExecution(id="exec1", workflow_id="wf1")
        execution.fail("Step failed")
        assert execution.status == ExecutionStatus.FAILED
        assert execution.error_message == "Step failed"

    def test_execution_cancel(self) -> None:
        """Test canceling execution."""
        execution = WorkflowExecution(id="exec1", workflow_id="wf1")
        execution.cancel()
        assert execution.status == ExecutionStatus.CANCELLED

    def test_execution_variables(self) -> None:
        """Test execution variables."""
        execution = WorkflowExecution(id="exec1", workflow_id="wf1")
        execution.set_variable("count", 5)
        assert execution.get_variable("count") == 5
        assert execution.get_variable("missing", "default") == "default"

    def test_execution_duration(self) -> None:
        """Test execution duration calculation."""
        execution = WorkflowExecution(id="exec1", workflow_id="wf1")
        assert execution.duration_seconds is None
        execution.complete()
        assert execution.duration_seconds is not None


# ============================================================
# ApprovalRequest Tests
# ============================================================

class TestApprovalRequest:
    """Test ApprovalRequest dataclass."""

    def test_create_approval_request(self) -> None:
        """Test creating an approval request."""
        request = ApprovalRequest(
            id="req1",
            execution_id="exec1",
            step_id="step1",
            requester_id="user1",
            approvers=["user2", "user3"],
            title="Budget Approval",
        )
        assert request.status == ApprovalStatus.PENDING
        assert len(request.approvers) == 2

    def test_approval_approve_single(self) -> None:
        """Test approving with single approval type."""
        request = ApprovalRequest(
            id="req1",
            execution_id="exec1",
            step_id="step1",
            requester_id="user1",
            approvers=["user2"],
            approval_type=ApprovalType.SINGLE,
        )
        result = request.approve("user2", "Looks good")
        assert result is True
        assert request.status == ApprovalStatus.APPROVED
        assert request.received_approvals == 1

    def test_approval_approve_all(self) -> None:
        """Test approving with all approval type."""
        request = ApprovalRequest(
            id="req1",
            execution_id="exec1",
            step_id="step1",
            requester_id="user1",
            approvers=["user2", "user3"],
            approval_type=ApprovalType.ALL,
        )
        request.approve("user2")
        assert request.status == ApprovalStatus.PENDING

        request.approve("user3")
        assert request.status == ApprovalStatus.APPROVED

    def test_approval_reject(self) -> None:
        """Test rejecting approval."""
        request = ApprovalRequest(
            id="req1",
            execution_id="exec1",
            step_id="step1",
            requester_id="user1",
            approvers=["user2"],
        )
        result = request.reject("user2", "Not approved")
        assert result is True
        assert request.status == ApprovalStatus.REJECTED

    def test_approval_delegate(self) -> None:
        """Test delegating approval."""
        request = ApprovalRequest(
            id="req1",
            execution_id="exec1",
            step_id="step1",
            requester_id="user1",
            approvers=["user2"],
        )
        result = request.delegate("user2", "user3", "Out of office")
        assert result is True
        assert "user2" not in request.approvers
        assert "user3" in request.approvers

    def test_approval_escalate(self) -> None:
        """Test escalating approval."""
        request = ApprovalRequest(
            id="req1",
            execution_id="exec1",
            step_id="step1",
            requester_id="user1",
            approvers=["user2"],
        )
        request.escalate("manager1")
        assert request.status == ApprovalStatus.ESCALATED
        assert "manager1" in request.approvers

    def test_approval_overdue(self) -> None:
        """Test overdue approval."""
        request = ApprovalRequest(
            id="req1",
            execution_id="exec1",
            step_id="step1",
            requester_id="user1",
            approvers=["user2"],
            due_at=datetime.utcnow() - timedelta(hours=1),
        )
        assert request.is_overdue is True

    def test_approval_not_overdue(self) -> None:
        """Test not overdue approval."""
        request = ApprovalRequest(
            id="req1",
            execution_id="exec1",
            step_id="step1",
            requester_id="user1",
            approvers=["user2"],
            due_at=datetime.utcnow() + timedelta(hours=24),
        )
        assert request.is_overdue is False


# ============================================================
# WorkflowRegistry Tests
# ============================================================

class TestWorkflowRegistry:
    """Test WorkflowRegistry class."""

    @pytest.fixture
    def registry(self) -> WorkflowRegistry:
        """Create a registry for testing."""
        return WorkflowRegistry()

    # Workflow CRUD tests
    def test_create_workflow(self, registry: WorkflowRegistry) -> None:
        """Test creating a workflow."""
        workflow = registry.create_workflow(
            name="Test Workflow",
            creator_id="user1",
            workflow_type=WorkflowType.AUTOMATION,
        )
        assert workflow.id is not None
        assert workflow.name == "Test Workflow"
        assert workflow.status == WorkflowStatus.DRAFT

    def test_get_workflow(self, registry: WorkflowRegistry) -> None:
        """Test getting a workflow."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        retrieved = registry.get_workflow(workflow.id)
        assert retrieved is not None
        assert retrieved.id == workflow.id

    def test_update_workflow(self, registry: WorkflowRegistry) -> None:
        """Test updating a workflow."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        updated = registry.update_workflow(
            workflow.id,
            name="Updated Workflow",
            description="New description",
        )
        assert updated is not None
        assert updated.name == "Updated Workflow"
        assert updated.version == 2

    def test_delete_workflow(self, registry: WorkflowRegistry) -> None:
        """Test deleting a workflow."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        result = registry.delete_workflow(workflow.id)
        assert result is True
        assert registry.get_workflow(workflow.id) is None

    def test_activate_workflow(self, registry: WorkflowRegistry) -> None:
        """Test activating a workflow."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        activated = registry.activate_workflow(workflow.id)
        assert activated.status == WorkflowStatus.ACTIVE

    def test_list_workflows(self, registry: WorkflowRegistry) -> None:
        """Test listing workflows."""
        registry.create_workflow(name="WF1", creator_id="user1", workflow_type=WorkflowType.AUTOMATION)
        registry.create_workflow(name="WF2", creator_id="user1", workflow_type=WorkflowType.APPROVAL)
        registry.create_workflow(name="WF3", creator_id="user2", workflow_type=WorkflowType.AUTOMATION)

        all_workflows = registry.list_workflows()
        assert len(all_workflows) == 3

        user1_workflows = registry.list_workflows(creator_id="user1")
        assert len(user1_workflows) == 2

        automations = registry.list_workflows(workflow_type=WorkflowType.AUTOMATION)
        assert len(automations) == 2

    # Trigger tests
    def test_add_trigger(self, registry: WorkflowRegistry) -> None:
        """Test adding a trigger."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        trigger = registry.add_trigger(
            workflow_id=workflow.id,
            trigger_type=TriggerType.EVENT,
            name="On Task Created",
            event_type="task.created",
        )
        assert trigger is not None
        assert trigger.event_type == "task.created"

    def test_get_triggers(self, registry: WorkflowRegistry) -> None:
        """Test getting triggers."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        registry.add_trigger(workflow.id, TriggerType.EVENT, event_type="e1")
        registry.add_trigger(workflow.id, TriggerType.SCHEDULE, schedule_cron="0 9 * * *")

        triggers = registry.get_triggers(workflow.id)
        assert len(triggers) == 2

    def test_delete_trigger(self, registry: WorkflowRegistry) -> None:
        """Test deleting a trigger."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        trigger = registry.add_trigger(workflow.id, TriggerType.MANUAL)
        result = registry.delete_trigger(workflow.id, trigger.id)
        assert result is True

    # Step tests
    def test_add_step(self, registry: WorkflowRegistry) -> None:
        """Test adding a step."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        step = registry.add_step(
            workflow_id=workflow.id,
            step_type=StepType.ACTION,
            name="Send Email",
        )
        assert step is not None
        assert step.name == "Send Email"

    def test_add_step_with_action(self, registry: WorkflowRegistry) -> None:
        """Test adding a step with action."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        action = WorkflowAction(
            id="a1",
            action_type=ActionType.SEND_NOTIFICATION,
            config={"message": "Hello"},
        )
        step = registry.add_step(
            workflow_id=workflow.id,
            step_type=StepType.ACTION,
            name="Notify",
            action=action,
        )
        assert step.action is not None
        assert step.action.action_type == ActionType.SEND_NOTIFICATION

    def test_get_steps(self, registry: WorkflowRegistry) -> None:
        """Test getting steps."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        registry.add_step(workflow.id, StepType.ACTION, "Step 1")
        registry.add_step(workflow.id, StepType.ACTION, "Step 2")

        steps = registry.get_steps(workflow.id)
        assert len(steps) == 2

    def test_get_first_step(self, registry: WorkflowRegistry) -> None:
        """Test getting first step."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        s1 = registry.add_step(workflow.id, StepType.ACTION, "First", position=0)
        registry.add_step(workflow.id, StepType.ACTION, "Second", position=1)

        first = registry.get_first_step(workflow.id)
        assert first.id == s1.id

    def test_get_next_step(self, registry: WorkflowRegistry) -> None:
        """Test getting next step."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        s1 = registry.add_step(workflow.id, StepType.ACTION, "Step 1")
        s2 = registry.add_step(workflow.id, StepType.ACTION, "Step 2")

        next_step = registry.get_next_step(workflow.id, s1.id)
        assert next_step.id == s2.id

    def test_delete_step(self, registry: WorkflowRegistry) -> None:
        """Test deleting a step."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        step = registry.add_step(workflow.id, StepType.ACTION, "Step")
        result = registry.delete_step(workflow.id, step.id)
        assert result is True

    # Execution tests
    def test_start_execution(self, registry: WorkflowRegistry) -> None:
        """Test starting an execution."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        registry.add_step(workflow.id, StepType.ACTION, "Step 1")
        registry.activate_workflow(workflow.id)

        execution = registry.start_execution(
            workflow_id=workflow.id,
            triggered_by="user1",
        )
        assert execution is not None
        assert execution.status == ExecutionStatus.RUNNING

    def test_start_execution_inactive_workflow(self, registry: WorkflowRegistry) -> None:
        """Test starting execution on inactive workflow."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        execution = registry.start_execution(workflow.id, "user1")
        assert execution is None

    def test_complete_execution(self, registry: WorkflowRegistry) -> None:
        """Test completing an execution."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        registry.activate_workflow(workflow.id)
        execution = registry.start_execution(workflow.id, "user1")

        completed = registry.complete_execution(execution.id)
        assert completed.status == ExecutionStatus.COMPLETED

    def test_fail_execution(self, registry: WorkflowRegistry) -> None:
        """Test failing an execution."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        registry.activate_workflow(workflow.id)
        execution = registry.start_execution(workflow.id, "user1")

        failed = registry.fail_execution(execution.id, "Error occurred")
        assert failed.status == ExecutionStatus.FAILED

    def test_get_executions(self, registry: WorkflowRegistry) -> None:
        """Test getting executions."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        registry.activate_workflow(workflow.id)

        registry.start_execution(workflow.id, "user1")
        registry.start_execution(workflow.id, "user2")

        executions = registry.get_executions(workflow.id)
        assert len(executions) == 2

    # Step execution tests
    def test_start_step_execution(self, registry: WorkflowRegistry) -> None:
        """Test starting a step execution."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        step = registry.add_step(workflow.id, StepType.ACTION, "Step")
        registry.activate_workflow(workflow.id)
        execution = registry.start_execution(workflow.id, "user1")

        step_exec = registry.start_step_execution(execution.id, step.id)
        assert step_exec is not None
        assert step_exec.status == ExecutionStatus.RUNNING

    def test_complete_step_execution(self, registry: WorkflowRegistry) -> None:
        """Test completing a step execution."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        step = registry.add_step(workflow.id, StepType.ACTION, "Step")
        registry.activate_workflow(workflow.id)
        execution = registry.start_execution(workflow.id, "user1")
        step_exec = registry.start_step_execution(execution.id, step.id)

        completed = registry.complete_step_execution(step_exec.id, {"result": "ok"})
        assert completed.status == ExecutionStatus.COMPLETED

    # Approval tests
    def test_create_approval_request(self, registry: WorkflowRegistry) -> None:
        """Test creating an approval request."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        step = registry.add_step(workflow.id, StepType.APPROVAL, "Approval")
        registry.activate_workflow(workflow.id)
        execution = registry.start_execution(workflow.id, "user1")

        request = registry.create_approval_request(
            execution_id=execution.id,
            step_id=step.id,
            requester_id="user1",
            approvers=["user2"],
            title="Please approve",
        )
        assert request is not None
        assert execution.status == ExecutionStatus.WAITING

    def test_approve_request(self, registry: WorkflowRegistry) -> None:
        """Test approving a request."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        step = registry.add_step(workflow.id, StepType.APPROVAL, "Approval")
        registry.activate_workflow(workflow.id)
        execution = registry.start_execution(workflow.id, "user1")

        request = registry.create_approval_request(
            execution.id, step.id, "user1", ["user2"], "Approve"
        )
        result = registry.approve_request(request.id, "user2")
        assert result is True

    def test_get_pending_approvals(self, registry: WorkflowRegistry) -> None:
        """Test getting pending approvals."""
        workflow = registry.create_workflow(name="Workflow", creator_id="user1")
        step = registry.add_step(workflow.id, StepType.APPROVAL, "Approval")
        registry.activate_workflow(workflow.id)
        execution = registry.start_execution(workflow.id, "user1")

        registry.create_approval_request(
            execution.id, step.id, "user1", ["user2", "user3"], "Request 1"
        )

        user2_pending = registry.get_pending_approvals(approver_id="user2")
        assert len(user2_pending) == 1

    # Template tests
    def test_create_template(self, registry: WorkflowRegistry) -> None:
        """Test creating a template."""
        template = registry.create_template(
            name="Basic Workflow",
            created_by="user1",
            workflow_type=WorkflowType.AUTOMATION,
        )
        assert template.id is not None
        assert template.name == "Basic Workflow"

    def test_create_workflow_from_template(self, registry: WorkflowRegistry) -> None:
        """Test creating workflow from template."""
        template = registry.create_template(
            name="Template",
            created_by="user1",
            steps_config=[
                {"step_type": "action", "name": "Step 1"},
            ],
        )

        workflow = registry.create_workflow_from_template(
            template.id, "New Workflow", "user2"
        )
        assert workflow is not None
        assert workflow.name == "New Workflow"

    def test_get_stats(self, registry: WorkflowRegistry) -> None:
        """Test getting stats."""
        registry.create_workflow(name="WF1", creator_id="user1")
        wf2 = registry.create_workflow(name="WF2", creator_id="user1")
        registry.activate_workflow(wf2.id)

        stats = registry.get_stats()
        assert stats["total_workflows"] == 2
        assert stats["active_workflows"] == 1


# ============================================================
# WorkflowManager Tests
# ============================================================

class TestWorkflowManager:
    """Test WorkflowManager class."""

    @pytest.fixture
    def manager(self) -> WorkflowManager:
        """Create a manager for testing."""
        return WorkflowManager()

    def test_create_workflow(self, manager: WorkflowManager) -> None:
        """Test creating a workflow."""
        workflow = manager.create_workflow(
            name="My Workflow",
            creator_id="user1",
            description="A test workflow",
        )
        assert workflow.id is not None
        assert workflow.name == "My Workflow"

    def test_create_approval_workflow(self, manager: WorkflowManager) -> None:
        """Test creating an approval workflow."""
        workflow = manager.create_approval_workflow(
            name="Budget Approval",
            creator_id="user1",
            approvers=["manager1", "manager2"],
            approval_type=ApprovalType.ALL,
        )
        assert workflow.workflow_type == WorkflowType.APPROVAL

        steps = manager.get_steps(workflow.id)
        assert len(steps) == 1
        assert steps[0].step_type == StepType.APPROVAL

    def test_create_notification_workflow(self, manager: WorkflowManager) -> None:
        """Test creating a notification workflow."""
        workflow = manager.create_notification_workflow(
            name="Task Alert",
            creator_id="user1",
            event_type="task.created",
            notification_config={"message": "New task created"},
        )
        assert workflow.workflow_type == WorkflowType.NOTIFICATION

        triggers = manager.get_triggers(workflow.id)
        assert len(triggers) == 1
        assert triggers[0].event_type == "task.created"

    def test_create_scheduled_workflow(self, manager: WorkflowManager) -> None:
        """Test creating a scheduled workflow."""
        workflow = manager.create_scheduled_workflow(
            name="Daily Report",
            creator_id="user1",
            schedule_cron="0 9 * * *",
        )

        triggers = manager.get_triggers(workflow.id)
        assert len(triggers) == 1
        assert triggers[0].trigger_type == TriggerType.SCHEDULE

    def test_add_action_step(self, manager: WorkflowManager) -> None:
        """Test adding an action step."""
        workflow = manager.create_workflow(name="WF", creator_id="user1")
        step = manager.add_action_step(
            workflow.id,
            "Send Email",
            ActionType.SEND_EMAIL,
            {"to": "user@example.com"},
        )
        assert step.step_type == StepType.ACTION
        assert step.action.action_type == ActionType.SEND_EMAIL

    def test_add_condition_step(self, manager: WorkflowManager) -> None:
        """Test adding a condition step."""
        workflow = manager.create_workflow(name="WF", creator_id="user1")
        step = manager.add_condition_step(
            workflow.id,
            "Check Status",
            field="status",
            operator=ConditionOperator.EQUALS,
            value="active",
        )
        assert step.step_type == StepType.CONDITION
        assert len(step.conditions) == 1

    def test_add_delay_step(self, manager: WorkflowManager) -> None:
        """Test adding a delay step."""
        workflow = manager.create_workflow(name="WF", creator_id="user1")
        step = manager.add_delay_step(workflow.id, "Wait", delay_seconds=3600)
        assert step.step_type == StepType.DELAY
        assert step.delay_seconds == 3600

    def test_add_approval_step(self, manager: WorkflowManager) -> None:
        """Test adding an approval step."""
        workflow = manager.create_workflow(name="WF", creator_id="user1")
        step = manager.add_approval_step(
            workflow.id,
            "Manager Approval",
            approvers=["manager1"],
            timeout_hours=48,
        )
        assert step.step_type == StepType.APPROVAL
        assert step.approval_step.timeout_hours == 48

    def test_link_steps(self, manager: WorkflowManager) -> None:
        """Test linking steps."""
        workflow = manager.create_workflow(name="WF", creator_id="user1")
        s1 = manager.add_action_step(workflow.id, "Step 1", ActionType.LOG_MESSAGE)
        s2 = manager.add_action_step(workflow.id, "Step 2", ActionType.LOG_MESSAGE)

        result = manager.link_steps(workflow.id, s1.id, s2.id)
        assert result is True

    def test_execute_workflow(self, manager: WorkflowManager) -> None:
        """Test executing a workflow."""
        workflow = manager.create_workflow(name="WF", creator_id="user1")
        manager.add_action_step(workflow.id, "Log", ActionType.LOG_MESSAGE)
        manager.activate_workflow(workflow.id)

        execution = manager.execute_workflow(
            workflow.id,
            triggered_by="user1",
            context={"key": "value"},
        )
        assert execution is not None
        assert execution.status == ExecutionStatus.RUNNING

    def test_trigger_workflow(self, manager: WorkflowManager) -> None:
        """Test triggering a workflow by event."""
        workflow = manager.create_workflow(name="WF", creator_id="user1")
        manager.add_event_trigger(workflow.id, "task.created")
        manager.add_action_step(workflow.id, "Log", ActionType.LOG_MESSAGE)
        manager.activate_workflow(workflow.id)

        execution = manager.trigger_workflow(
            workflow.id,
            event_type="task.created",
            event_data={"task_id": "123"},
            triggered_by="system",
        )
        assert execution is not None

    def test_trigger_workflow_no_match(self, manager: WorkflowManager) -> None:
        """Test triggering with non-matching event."""
        workflow = manager.create_workflow(name="WF", creator_id="user1")
        manager.add_event_trigger(workflow.id, "task.created")
        manager.activate_workflow(workflow.id)

        execution = manager.trigger_workflow(
            workflow.id,
            event_type="task.deleted",
            event_data={},
            triggered_by="system",
        )
        assert execution is None

    def test_run_step(self, manager: WorkflowManager) -> None:
        """Test running a step."""
        workflow = manager.create_workflow(name="WF", creator_id="user1")
        step = manager.add_action_step(
            workflow.id, "Log", ActionType.LOG_MESSAGE, {"message": "Hello"}
        )
        manager.activate_workflow(workflow.id)
        execution = manager.execute_workflow(workflow.id, "user1")

        step_exec = manager.run_step(execution.id, step.id)
        assert step_exec is not None
        assert step_exec.status == ExecutionStatus.COMPLETED

    def test_approve_reject_workflow(self, manager: WorkflowManager) -> None:
        """Test approve/reject in workflow."""
        workflow = manager.create_approval_workflow(
            name="Approval",
            creator_id="user1",
            approvers=["user2"],
        )
        manager.activate_workflow(workflow.id)
        execution = manager.execute_workflow(workflow.id, "user1")
        step = manager.get_steps(workflow.id)[0]
        manager.run_step(execution.id, step.id)

        pending = manager.get_pending_approvals(approver_id="user2")
        assert len(pending) == 1

        result = manager.approve(pending[0].id, "user2", "Approved")
        assert result is True

    def test_save_workflow_as_template(self, manager: WorkflowManager) -> None:
        """Test saving workflow as template."""
        workflow = manager.create_workflow(name="WF", creator_id="user1")
        manager.add_action_step(workflow.id, "Step 1", ActionType.LOG_MESSAGE)
        manager.add_event_trigger(workflow.id, "task.created")

        template = manager.save_workflow_as_template(
            workflow.id, "My Template", "user1"
        )
        assert template is not None
        assert template.name == "My Template"
        assert len(template.steps_config) == 1

    def test_get_workflow_summary(self, manager: WorkflowManager) -> None:
        """Test getting workflow summary."""
        workflow = manager.create_workflow(name="WF", creator_id="user1")
        manager.add_action_step(workflow.id, "Step 1", ActionType.LOG_MESSAGE)
        manager.add_event_trigger(workflow.id, "task.created")

        summary = manager.get_workflow_summary(workflow.id)
        assert summary["step_count"] == 1
        assert summary["trigger_count"] == 1

    def test_get_stats(self, manager: WorkflowManager) -> None:
        """Test getting stats."""
        manager.create_workflow(name="WF1", creator_id="user1")
        wf2 = manager.create_workflow(name="WF2", creator_id="user1")
        manager.activate_workflow(wf2.id)

        stats = manager.get_stats()
        assert stats["total_workflows"] == 2
        assert stats["active_workflows"] == 1


# ============================================================
# Global Instance Tests
# ============================================================

class TestGlobalInstance:
    """Test global instance management."""

    def setup_method(self) -> None:
        """Reset before each test."""
        reset_workflow_manager()

    def teardown_method(self) -> None:
        """Reset after each test."""
        reset_workflow_manager()

    def test_get_workflow_manager(self) -> None:
        """Test getting global manager."""
        manager = get_workflow_manager()
        assert manager is not None
        assert isinstance(manager, WorkflowManager)

    def test_get_same_instance(self) -> None:
        """Test getting same instance."""
        manager1 = get_workflow_manager()
        manager2 = get_workflow_manager()
        assert manager1 is manager2

    def test_set_workflow_manager(self) -> None:
        """Test setting custom manager."""
        custom = WorkflowManager()
        set_workflow_manager(custom)
        assert get_workflow_manager() is custom

    def test_reset_workflow_manager(self) -> None:
        """Test resetting manager."""
        manager1 = get_workflow_manager()
        reset_workflow_manager()
        manager2 = get_workflow_manager()
        assert manager1 is not manager2
