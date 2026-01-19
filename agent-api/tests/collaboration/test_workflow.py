"""
Tests for Workflow Automation Module
"""

import pytest
import time
from datetime import datetime, timedelta

from app.collaboration.workflow import (
    WorkflowEngine,
    WorkflowConfig,
    WorkflowDefinition,
    WorkflowInstance,
    WorkflowStatus,
    WorkflowStep,
    WorkflowBuilder,
    StepStatus,
    StepExecution,
    TriggerType,
    TriggerManager,
    Trigger,
    ActionType,
    ActionConfig,
    ActionExecutor,
    ActionResult,
    ConditionOperator,
    LogicalOperator,
    Condition,
    ConditionGroup,
    ConditionEvaluator,
    ConditionalRouter,
    Transition,
    get_workflow_engine,
    set_workflow_engine,
    reset_workflow_engine,
)


# ==================== Condition Tests ====================

class TestCondition:
    """Tests for Condition class."""

    def test_equals_condition(self):
        """Test equals condition."""
        condition = Condition("status", ConditionOperator.EQUALS, "active")
        assert condition.evaluate({"status": "active"})
        assert not condition.evaluate({"status": "inactive"})

    def test_not_equals_condition(self):
        """Test not equals condition."""
        condition = Condition("status", ConditionOperator.NOT_EQUALS, "deleted")
        assert condition.evaluate({"status": "active"})
        assert not condition.evaluate({"status": "deleted"})

    def test_greater_than_condition(self):
        """Test greater than condition."""
        condition = Condition("score", ConditionOperator.GREATER_THAN, 50)
        assert condition.evaluate({"score": 75})
        assert not condition.evaluate({"score": 50})
        assert not condition.evaluate({"score": 25})

    def test_less_than_condition(self):
        """Test less than condition."""
        condition = Condition("count", ConditionOperator.LESS_THAN, 10)
        assert condition.evaluate({"count": 5})
        assert not condition.evaluate({"count": 10})
        assert not condition.evaluate({"count": 15})

    def test_greater_or_equal_condition(self):
        """Test greater or equal condition."""
        condition = Condition("age", ConditionOperator.GREATER_OR_EQUAL, 18)
        assert condition.evaluate({"age": 18})
        assert condition.evaluate({"age": 25})
        assert not condition.evaluate({"age": 17})

    def test_less_or_equal_condition(self):
        """Test less or equal condition."""
        condition = Condition("priority", ConditionOperator.LESS_OR_EQUAL, 3)
        assert condition.evaluate({"priority": 3})
        assert condition.evaluate({"priority": 1})
        assert not condition.evaluate({"priority": 5})

    def test_contains_condition(self):
        """Test contains condition."""
        condition = Condition("tags", ConditionOperator.CONTAINS, "urgent")
        assert condition.evaluate({"tags": ["urgent", "important"]})
        assert condition.evaluate({"tags": "urgent task"})
        assert not condition.evaluate({"tags": ["normal"]})

    def test_not_contains_condition(self):
        """Test not contains condition."""
        condition = Condition("tags", ConditionOperator.NOT_CONTAINS, "spam")
        assert condition.evaluate({"tags": ["urgent", "important"]})
        assert not condition.evaluate({"tags": ["spam", "junk"]})

    def test_starts_with_condition(self):
        """Test starts with condition."""
        condition = Condition("name", ConditionOperator.STARTS_WITH, "test_")
        assert condition.evaluate({"name": "test_workflow"})
        assert not condition.evaluate({"name": "workflow_test"})

    def test_ends_with_condition(self):
        """Test ends with condition."""
        condition = Condition("file", ConditionOperator.ENDS_WITH, ".py")
        assert condition.evaluate({"file": "test.py"})
        assert not condition.evaluate({"file": "test.js"})

    def test_matches_condition(self):
        """Test regex matches condition."""
        condition = Condition("email", ConditionOperator.MATCHES, r".*@example\.com")
        assert condition.evaluate({"email": "user@example.com"})
        assert not condition.evaluate({"email": "user@other.com"})

    def test_in_condition(self):
        """Test in condition."""
        condition = Condition("status", ConditionOperator.IN, ["active", "pending"])
        assert condition.evaluate({"status": "active"})
        assert condition.evaluate({"status": "pending"})
        assert not condition.evaluate({"status": "deleted"})

    def test_not_in_condition(self):
        """Test not in condition."""
        condition = Condition("status", ConditionOperator.NOT_IN, ["deleted", "archived"])
        assert condition.evaluate({"status": "active"})
        assert not condition.evaluate({"status": "deleted"})

    def test_is_null_condition(self):
        """Test is null condition."""
        condition = Condition("value", ConditionOperator.IS_NULL)
        assert condition.evaluate({"value": None})
        assert condition.evaluate({})
        assert not condition.evaluate({"value": "something"})

    def test_is_not_null_condition(self):
        """Test is not null condition."""
        condition = Condition("value", ConditionOperator.IS_NOT_NULL)
        assert condition.evaluate({"value": "something"})
        assert not condition.evaluate({"value": None})
        assert not condition.evaluate({})

    def test_nested_field_access(self):
        """Test nested field access with dot notation."""
        condition = Condition("user.name", ConditionOperator.EQUALS, "Alice")
        assert condition.evaluate({"user": {"name": "Alice"}})
        assert not condition.evaluate({"user": {"name": "Bob"}})

    def test_deeply_nested_field(self):
        """Test deeply nested field access."""
        condition = Condition("data.meta.version", ConditionOperator.EQUALS, "1.0")
        context = {"data": {"meta": {"version": "1.0"}}}
        assert condition.evaluate(context)


class TestConditionGroup:
    """Tests for ConditionGroup class."""

    def test_and_condition_group(self):
        """Test AND condition group."""
        group = ConditionGroup(
            conditions=[
                Condition("status", ConditionOperator.EQUALS, "active"),
                Condition("score", ConditionOperator.GREATER_THAN, 50),
            ],
            operator=LogicalOperator.AND
        )
        assert group.evaluate({"status": "active", "score": 75})
        assert not group.evaluate({"status": "active", "score": 25})
        assert not group.evaluate({"status": "inactive", "score": 75})

    def test_or_condition_group(self):
        """Test OR condition group."""
        group = ConditionGroup(
            conditions=[
                Condition("priority", ConditionOperator.EQUALS, "high"),
                Condition("urgent", ConditionOperator.EQUALS, True),
            ],
            operator=LogicalOperator.OR
        )
        assert group.evaluate({"priority": "high", "urgent": False})
        assert group.evaluate({"priority": "low", "urgent": True})
        assert not group.evaluate({"priority": "low", "urgent": False})

    def test_not_condition_group(self):
        """Test NOT condition group."""
        group = ConditionGroup(
            conditions=[Condition("status", ConditionOperator.EQUALS, "deleted")],
            operator=LogicalOperator.NOT
        )
        assert group.evaluate({"status": "active"})
        assert not group.evaluate({"status": "deleted"})

    def test_nested_condition_groups(self):
        """Test nested condition groups."""
        inner_group = ConditionGroup(
            conditions=[
                Condition("role", ConditionOperator.EQUALS, "admin"),
                Condition("verified", ConditionOperator.EQUALS, True),
            ],
            operator=LogicalOperator.AND
        )
        outer_group = ConditionGroup(
            conditions=[
                Condition("bypass", ConditionOperator.EQUALS, True),
                inner_group,
            ],
            operator=LogicalOperator.OR
        )
        # Bypass allows access
        assert outer_group.evaluate({"bypass": True, "role": "user", "verified": False})
        # Admin and verified allows access
        assert outer_group.evaluate({"bypass": False, "role": "admin", "verified": True})
        # Neither condition met
        assert not outer_group.evaluate({"bypass": False, "role": "user", "verified": True})

    def test_empty_condition_group(self):
        """Test empty condition group returns True."""
        group = ConditionGroup(conditions=[], operator=LogicalOperator.AND)
        assert group.evaluate({})


class TestConditionEvaluator:
    """Tests for ConditionEvaluator class."""

    def test_evaluate_simple_condition(self):
        """Test evaluating a simple condition."""
        evaluator = ConditionEvaluator()
        condition = Condition("value", ConditionOperator.EQUALS, 42)
        assert evaluator.evaluate(condition, {"value": 42})
        assert not evaluator.evaluate(condition, {"value": 0})

    def test_evaluate_expression(self):
        """Test evaluating expression strings."""
        evaluator = ConditionEvaluator()
        assert evaluator.evaluate_expression("status == 'active'", {"status": "active"})
        assert evaluator.evaluate_expression("count > 5", {"count": 10})
        assert evaluator.evaluate_expression("count < 5", {"count": 3})
        assert evaluator.evaluate_expression("value >= 10", {"value": 10})
        assert evaluator.evaluate_expression("value <= 10", {"value": 5})
        assert evaluator.evaluate_expression("name != 'test'", {"name": "prod"})


# ==================== Trigger Tests ====================

class TestTrigger:
    """Tests for Trigger class."""

    def test_create_manual_trigger(self):
        """Test creating a manual trigger."""
        trigger = Trigger(id="t1", type=TriggerType.MANUAL, name="Manual Start")
        assert trigger.id == "t1"
        assert trigger.type == TriggerType.MANUAL
        assert trigger.enabled

    def test_create_event_trigger(self):
        """Test creating an event trigger."""
        trigger = Trigger(
            id="t1",
            type=TriggerType.EVENT,
            event_name="task.created"
        )
        assert trigger.event_name == "task.created"

    def test_event_trigger_matches(self):
        """Test event trigger matching."""
        trigger = Trigger(
            id="t1",
            type=TriggerType.EVENT,
            event_name="task.created"
        )
        assert trigger.matches_event("task.created", {})
        assert not trigger.matches_event("task.updated", {})

    def test_event_trigger_with_condition(self):
        """Test event trigger with condition."""
        trigger = Trigger(
            id="t1",
            type=TriggerType.EVENT,
            event_name="task.created",
            condition=ConditionGroup(conditions=[
                Condition("priority", ConditionOperator.EQUALS, "high")
            ])
        )
        assert trigger.matches_event("task.created", {"priority": "high"})
        assert not trigger.matches_event("task.created", {"priority": "low"})

    def test_disabled_trigger_no_match(self):
        """Test disabled trigger doesn't match."""
        trigger = Trigger(
            id="t1",
            type=TriggerType.EVENT,
            event_name="task.created",
            enabled=False
        )
        assert not trigger.matches_event("task.created", {})

    def test_non_event_trigger_no_match(self):
        """Test non-event trigger doesn't match events."""
        trigger = Trigger(id="t1", type=TriggerType.MANUAL)
        assert not trigger.matches_event("task.created", {})


class TestTriggerManager:
    """Tests for TriggerManager class."""

    def test_register_trigger(self):
        """Test registering a trigger."""
        manager = TriggerManager()
        trigger = Trigger(id="t1", type=TriggerType.EVENT, event_name="test.event")
        manager.register_trigger("wf1", trigger)

        triggers = manager.get_triggers("wf1")
        assert len(triggers) == 1
        assert triggers[0].id == "t1"

    def test_unregister_trigger(self):
        """Test unregistering a trigger."""
        manager = TriggerManager()
        trigger = Trigger(id="t1", type=TriggerType.EVENT, event_name="test.event")
        manager.register_trigger("wf1", trigger)

        assert manager.unregister_trigger("wf1", "t1")
        assert len(manager.get_triggers("wf1")) == 0

    def test_unregister_nonexistent_trigger(self):
        """Test unregistering nonexistent trigger."""
        manager = TriggerManager()
        assert not manager.unregister_trigger("wf1", "t1")

    def test_find_matching_workflows(self):
        """Test finding workflows matching an event."""
        manager = TriggerManager()
        trigger1 = Trigger(id="t1", type=TriggerType.EVENT, event_name="task.created")
        trigger2 = Trigger(id="t2", type=TriggerType.EVENT, event_name="task.updated")
        manager.register_trigger("wf1", trigger1)
        manager.register_trigger("wf2", trigger2)

        matches = manager.find_matching_workflows("task.created", {})
        assert "wf1" in matches
        assert "wf2" not in matches

    def test_enable_disable_trigger(self):
        """Test enabling and disabling triggers."""
        manager = TriggerManager()
        trigger = Trigger(id="t1", type=TriggerType.EVENT, event_name="test.event")
        manager.register_trigger("wf1", trigger)

        manager.disable_trigger("wf1", "t1")
        matches = manager.find_matching_workflows("test.event", {})
        assert len(matches) == 0

        manager.enable_trigger("wf1", "t1")
        matches = manager.find_matching_workflows("test.event", {})
        assert "wf1" in matches


# ==================== Action Tests ====================

class TestActionConfig:
    """Tests for ActionConfig class."""

    def test_create_action_config(self):
        """Test creating action config."""
        config = ActionConfig(
            type=ActionType.TASK,
            handler="process_task",
            params={"task_id": "123"},
            timeout_ms=5000,
            retry_count=2
        )
        assert config.type == ActionType.TASK
        assert config.handler == "process_task"
        assert config.params["task_id"] == "123"
        assert config.timeout_ms == 5000
        assert config.retry_count == 2


class TestActionExecutor:
    """Tests for ActionExecutor class."""

    def test_create_executor(self):
        """Test creating action executor."""
        executor = ActionExecutor()
        assert executor is not None

    def test_execute_log_action(self):
        """Test executing log action."""
        executor = ActionExecutor()
        action = ActionConfig(
            type=ActionType.TASK,
            handler="log",
            params={"message": "Test log", "level": "info"}
        )
        result = executor.execute(action, {})
        assert result.success
        assert result.result["logged"]
        assert result.result["message"] == "Test log"

    def test_execute_set_variable_action(self):
        """Test executing set variable action."""
        executor = ActionExecutor()
        action = ActionConfig(
            type=ActionType.TASK,
            handler="set_variable",
            params={"name": "test_var", "value": 42}
        )
        context = {}
        result = executor.execute(action, context)
        assert result.success
        assert context["test_var"] == 42

    def test_execute_wait_action(self):
        """Test executing wait action."""
        executor = ActionExecutor()
        action = ActionConfig(
            type=ActionType.WAIT,
            handler="wait",
            params={"duration_ms": 10}
        )
        start = time.time()
        result = executor.execute(action, {})
        elapsed = time.time() - start
        assert result.success
        assert elapsed >= 0.01  # At least 10ms

    def test_execute_transform_action(self):
        """Test executing transform action."""
        executor = ActionExecutor()
        action = ActionConfig(
            type=ActionType.DATA_TRANSFORM,
            handler="transform",
            params={"source": "input", "target": "output", "transform": "uppercase"}
        )
        context = {"input": "hello"}
        result = executor.execute(action, context)
        assert result.success
        assert context["output"] == "HELLO"

    def test_execute_with_retry(self):
        """Test action execution with retry."""
        executor = ActionExecutor()
        call_count = [0]

        def failing_handler(params, context):
            call_count[0] += 1
            if call_count[0] < 3:
                raise Exception("Temporary failure")
            return {"success": True}

        executor.register_handler("failing", failing_handler)
        action = ActionConfig(
            type=ActionType.TASK,
            handler="failing",
            retry_count=3,
            retry_delay_ms=10
        )
        result = executor.execute(action, {})
        assert result.success
        assert call_count[0] == 3

    def test_execute_failure_exhausts_retries(self):
        """Test action failure after exhausting retries."""
        executor = ActionExecutor()

        def always_fail(params, context):
            raise Exception("Always fails")

        executor.register_handler("always_fail", always_fail)
        action = ActionConfig(
            type=ActionType.TASK,
            handler="always_fail",
            retry_count=2,
            retry_delay_ms=10
        )
        result = executor.execute(action, {})
        assert not result.success
        assert result.error == "Always fails"
        assert result.retry_count == 2

    def test_register_custom_handler(self):
        """Test registering custom handler."""
        executor = ActionExecutor()

        def custom_handler(params, context):
            return {"custom": True, "value": params.get("value")}

        executor.register_handler("custom", custom_handler)
        action = ActionConfig(
            type=ActionType.TASK,
            handler="custom",
            params={"value": "test"}
        )
        result = executor.execute(action, {})
        assert result.success
        assert result.result["custom"]
        assert result.result["value"] == "test"


# ==================== Router Tests ====================

class TestConditionalRouter:
    """Tests for ConditionalRouter class."""

    def test_add_route(self):
        """Test adding a route."""
        router = ConditionalRouter()
        router.add_route("step1", "step2")
        next_step = router.get_next_step("step1", {})
        assert next_step == "step2"

    def test_conditional_route(self):
        """Test conditional routing."""
        router = ConditionalRouter()
        condition = ConditionGroup(conditions=[
            Condition("approved", ConditionOperator.EQUALS, True)
        ])
        router.add_route("review", "publish", condition)
        router.add_route("review", "reject", priority=-1)

        assert router.get_next_step("review", {"approved": True}) == "publish"
        assert router.get_next_step("review", {"approved": False}) == "reject"

    def test_priority_routing(self):
        """Test priority-based routing."""
        router = ConditionalRouter()
        router.add_route("start", "path_a", priority=1)
        router.add_route("start", "path_b", priority=2)

        # Higher priority wins
        assert router.get_next_step("start", {}) == "path_b"

    def test_no_matching_route(self):
        """Test no matching route returns None."""
        router = ConditionalRouter()
        condition = ConditionGroup(conditions=[
            Condition("impossible", ConditionOperator.EQUALS, True)
        ])
        router.add_route("step1", "step2", condition)

        assert router.get_next_step("step1", {}) is None


# ==================== Workflow Definition Tests ====================

class TestWorkflowStep:
    """Tests for WorkflowStep class."""

    def test_create_step(self):
        """Test creating a workflow step."""
        action = ActionConfig(type=ActionType.TASK, handler="process")
        step = WorkflowStep(id="step1", name="Process Step", action=action)
        assert step.id == "step1"
        assert step.name == "Process Step"
        assert step.action.handler == "process"

    def test_step_transitions(self):
        """Test step transitions."""
        action = ActionConfig(type=ActionType.TASK)
        step = WorkflowStep(
            id="step1",
            name="Step 1",
            action=action,
            transitions=[
                Transition(target_step="step2"),
            ]
        )
        assert step.get_next_step({}) == "step2"

    def test_step_conditional_transitions(self):
        """Test step conditional transitions."""
        action = ActionConfig(type=ActionType.TASK)
        step = WorkflowStep(
            id="review",
            name="Review",
            action=action,
            transitions=[
                Transition(
                    target_step="approve",
                    condition=ConditionGroup(conditions=[
                        Condition("score", ConditionOperator.GREATER_THAN, 80)
                    ]),
                    priority=1
                ),
                Transition(target_step="reject", priority=0),
            ]
        )
        assert step.get_next_step({"score": 90}) == "approve"
        assert step.get_next_step({"score": 60}) == "reject"


class TestWorkflowDefinition:
    """Tests for WorkflowDefinition class."""

    def test_create_definition(self):
        """Test creating a workflow definition."""
        definition = WorkflowDefinition(id="wf1", name="Test Workflow")
        assert definition.id == "wf1"
        assert definition.name == "Test Workflow"
        assert definition.version == "1.0.0"

    def test_add_step(self):
        """Test adding steps to workflow."""
        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.TASK)
        step = WorkflowStep(id="step1", name="Step 1", action=action)
        definition.add_step(step)

        assert "step1" in definition.steps
        assert definition.initial_step == "step1"

    def test_get_step(self):
        """Test getting a step."""
        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.TASK)
        step = WorkflowStep(id="step1", name="Step 1", action=action)
        definition.add_step(step)

        retrieved = definition.get_step("step1")
        assert retrieved is not None
        assert retrieved.id == "step1"

    def test_get_nonexistent_step(self):
        """Test getting nonexistent step."""
        definition = WorkflowDefinition(id="wf1", name="Test")
        assert definition.get_step("nonexistent") is None

    def test_validate_empty_workflow(self):
        """Test validating empty workflow."""
        definition = WorkflowDefinition(id="wf1", name="Test")
        errors = definition.validate()
        assert "Workflow must have at least one step" in errors

    def test_validate_invalid_initial_step(self):
        """Test validating invalid initial step."""
        definition = WorkflowDefinition(id="wf1", name="Test")
        definition.initial_step = "nonexistent"
        errors = definition.validate()
        assert any("Initial step" in e for e in errors)

    def test_validate_invalid_transition(self):
        """Test validating invalid transition."""
        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.TASK)
        step = WorkflowStep(
            id="step1",
            name="Step 1",
            action=action,
            transitions=[Transition(target_step="nonexistent")]
        )
        definition.add_step(step)
        errors = definition.validate()
        assert any("invalid transition" in e for e in errors)


class TestStepExecution:
    """Tests for StepExecution class."""

    def test_create_execution(self):
        """Test creating step execution."""
        execution = StepExecution(step_id="step1")
        assert execution.step_id == "step1"
        assert execution.status == StepStatus.PENDING
        assert execution.attempt == 0

    def test_execution_duration(self):
        """Test execution duration calculation."""
        execution = StepExecution(step_id="step1")
        execution.started_at = datetime.utcnow()
        time.sleep(0.01)
        execution.completed_at = datetime.utcnow()
        assert execution.duration_ms is not None
        assert execution.duration_ms >= 10


class TestWorkflowInstance:
    """Tests for WorkflowInstance class."""

    def test_create_instance(self):
        """Test creating workflow instance."""
        instance = WorkflowInstance(id="inst1", workflow_id="wf1")
        assert instance.id == "inst1"
        assert instance.workflow_id == "wf1"
        assert instance.status == WorkflowStatus.ACTIVE

    def test_instance_duration(self):
        """Test instance duration calculation."""
        instance = WorkflowInstance(id="inst1", workflow_id="wf1")
        time.sleep(0.01)
        duration = instance.duration_ms
        assert duration is not None
        assert duration >= 10

    def test_step_executions(self):
        """Test managing step executions."""
        instance = WorkflowInstance(id="inst1", workflow_id="wf1")
        execution = StepExecution(step_id="step1", status=StepStatus.COMPLETED)
        instance.set_step_execution(execution)

        retrieved = instance.get_step_execution("step1")
        assert retrieved is not None
        assert retrieved.status == StepStatus.COMPLETED


# ==================== Workflow Engine Tests ====================

class TestWorkflowEngine:
    """Tests for WorkflowEngine class."""

    def test_create_engine(self):
        """Test creating workflow engine."""
        engine = WorkflowEngine()
        assert engine is not None

    def test_create_engine_with_config(self):
        """Test creating engine with config."""
        config = WorkflowConfig(max_concurrent_workflows=50)
        engine = WorkflowEngine(config)
        assert engine.config.max_concurrent_workflows == 50

    def test_register_workflow(self):
        """Test registering a workflow."""
        engine = WorkflowEngine()
        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.TASK, handler="log", params={"message": "test"})
        definition.add_step(WorkflowStep(id="step1", name="Step 1", action=action))

        errors = engine.register_workflow(definition)
        assert len(errors) == 0
        assert engine.get_workflow("wf1") is not None

    def test_register_invalid_workflow(self):
        """Test registering invalid workflow."""
        engine = WorkflowEngine()
        definition = WorkflowDefinition(id="wf1", name="Test")
        errors = engine.register_workflow(definition)
        assert len(errors) > 0

    def test_unregister_workflow(self):
        """Test unregistering a workflow."""
        engine = WorkflowEngine()
        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.TASK, handler="log")
        definition.add_step(WorkflowStep(id="step1", name="Step 1", action=action))
        engine.register_workflow(definition)

        assert engine.unregister_workflow("wf1")
        assert engine.get_workflow("wf1") is None

    def test_start_workflow(self):
        """Test starting a workflow."""
        engine = WorkflowEngine()
        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.TASK, handler="log", params={"message": "test"})
        definition.add_step(WorkflowStep(id="step1", name="Step 1", action=action))
        engine.register_workflow(definition)

        instance = engine.start_workflow("wf1", {"key": "value"})
        assert instance is not None
        assert instance.workflow_id == "wf1"
        assert instance.input_data["key"] == "value"
        assert instance.status == WorkflowStatus.ACTIVE

    def test_start_nonexistent_workflow(self):
        """Test starting nonexistent workflow."""
        engine = WorkflowEngine()
        instance = engine.start_workflow("nonexistent")
        assert instance is None

    def test_execute_step(self):
        """Test executing a workflow step."""
        engine = WorkflowEngine()
        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.TASK, handler="log", params={"message": "test"})
        definition.add_step(WorkflowStep(id="step1", name="Step 1", action=action))
        engine.register_workflow(definition)

        instance = engine.start_workflow("wf1")
        execution = engine.execute_step(instance.id)
        assert execution is not None
        assert execution.status == StepStatus.COMPLETED

    def test_run_workflow_to_completion(self):
        """Test running workflow to completion."""
        engine = WorkflowEngine()
        definition = WorkflowDefinition(id="wf1", name="Test")
        action1 = ActionConfig(type=ActionType.TASK, handler="log", params={"message": "step1"})
        action2 = ActionConfig(type=ActionType.TASK, handler="log", params={"message": "step2"})
        step1 = WorkflowStep(
            id="step1", name="Step 1", action=action1,
            transitions=[Transition(target_step="step2")]
        )
        step2 = WorkflowStep(id="step2", name="Step 2", action=action2)
        definition.add_step(step1)
        definition.add_step(step2)
        engine.register_workflow(definition)

        instance = engine.run_workflow("wf1")
        assert instance is not None
        assert instance.status == WorkflowStatus.COMPLETED
        assert len(instance.step_executions) == 2

    def test_pause_workflow(self):
        """Test pausing a workflow."""
        engine = WorkflowEngine()
        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.TASK, handler="log")
        definition.add_step(WorkflowStep(id="step1", name="Step 1", action=action))
        engine.register_workflow(definition)

        instance = engine.start_workflow("wf1")
        assert engine.pause_workflow(instance.id)
        assert instance.status == WorkflowStatus.PAUSED

    def test_resume_workflow(self):
        """Test resuming a paused workflow."""
        engine = WorkflowEngine()
        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.TASK, handler="log")
        definition.add_step(WorkflowStep(id="step1", name="Step 1", action=action))
        engine.register_workflow(definition)

        instance = engine.start_workflow("wf1")
        engine.pause_workflow(instance.id)
        assert engine.resume_workflow(instance.id)
        assert instance.status == WorkflowStatus.ACTIVE

    def test_cancel_workflow(self):
        """Test cancelling a workflow."""
        engine = WorkflowEngine()
        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.TASK, handler="log")
        definition.add_step(WorkflowStep(id="step1", name="Step 1", action=action))
        engine.register_workflow(definition)

        instance = engine.start_workflow("wf1")
        assert engine.cancel_workflow(instance.id)
        assert instance.status == WorkflowStatus.CANCELLED

    def test_get_active_instances(self):
        """Test getting active instances."""
        engine = WorkflowEngine()
        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.TASK, handler="log")
        definition.add_step(WorkflowStep(id="step1", name="Step 1", action=action))
        engine.register_workflow(definition)

        engine.start_workflow("wf1")
        engine.start_workflow("wf1")

        active = engine.get_active_instances()
        assert len(active) == 2

    def test_handle_event(self):
        """Test handling events to trigger workflows."""
        engine = WorkflowEngine()
        definition = WorkflowDefinition(id="wf1", name="Test")
        definition.triggers.append(Trigger(
            id="t1",
            type=TriggerType.EVENT,
            event_name="task.created"
        ))
        action = ActionConfig(type=ActionType.TASK, handler="log")
        definition.add_step(WorkflowStep(id="step1", name="Step 1", action=action))
        engine.register_workflow(definition)

        instances = engine.handle_event("task.created", {"task_id": "123"})
        assert len(instances) == 1
        assert instances[0].triggered_by == "event:task.created"

    def test_workflow_callbacks(self):
        """Test workflow event callbacks."""
        engine = WorkflowEngine()
        events = []

        engine.on("workflow_started", lambda i: events.append(("started", i.id)))
        engine.on("workflow_completed", lambda i: events.append(("completed", i.id)))

        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.TASK, handler="log")
        definition.add_step(WorkflowStep(id="step1", name="Step 1", action=action))
        engine.register_workflow(definition)

        instance = engine.run_workflow("wf1")
        assert any(e[0] == "started" for e in events)
        assert any(e[0] == "completed" for e in events)

    def test_max_concurrent_workflows(self):
        """Test max concurrent workflows limit."""
        config = WorkflowConfig(max_concurrent_workflows=2)
        engine = WorkflowEngine(config)

        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.WAIT, handler="wait", params={"duration_ms": 1000})
        definition.add_step(WorkflowStep(id="step1", name="Step 1", action=action))
        engine.register_workflow(definition)

        inst1 = engine.start_workflow("wf1")
        inst2 = engine.start_workflow("wf1")
        inst3 = engine.start_workflow("wf1")  # Should be rejected

        assert inst1 is not None
        assert inst2 is not None
        assert inst3 is None

    def test_get_stats(self):
        """Test getting engine stats."""
        engine = WorkflowEngine()
        definition = WorkflowDefinition(id="wf1", name="Test")
        action = ActionConfig(type=ActionType.TASK, handler="log")
        definition.add_step(WorkflowStep(id="step1", name="Step 1", action=action))
        engine.register_workflow(definition)

        engine.start_workflow("wf1")
        engine.run_workflow("wf1")

        stats = engine.get_stats()
        assert stats["total_definitions"] == 1
        assert stats["total_instances"] == 2


# ==================== Workflow Builder Tests ====================

class TestWorkflowBuilder:
    """Tests for WorkflowBuilder class."""

    def test_build_simple_workflow(self):
        """Test building a simple workflow."""
        workflow = (WorkflowBuilder("wf1", "Test Workflow")
            .description("A test workflow")
            .version("1.0.0")
            .step("step1", "First Step", ActionType.TASK, "log", {"message": "Hello"})
            .build())

        assert workflow.id == "wf1"
        assert workflow.name == "Test Workflow"
        assert workflow.description == "A test workflow"
        assert "step1" in workflow.steps

    def test_build_workflow_with_transitions(self):
        """Test building workflow with transitions."""
        workflow = (WorkflowBuilder("wf1", "Test")
            .step("step1", "Step 1", ActionType.TASK, "log")
            .then("step2")
            .step("step2", "Step 2", ActionType.TASK, "log")
            .build())

        assert len(workflow.steps) == 2
        assert workflow.steps["step1"].transitions[0].target_step == "step2"

    def test_build_workflow_with_triggers(self):
        """Test building workflow with triggers."""
        workflow = (WorkflowBuilder("wf1", "Test")
            .on_event("t1", "task.created")
            .step("step1", "Step 1", ActionType.TASK, "log")
            .build())

        assert len(workflow.triggers) == 1
        assert workflow.triggers[0].event_name == "task.created"

    def test_build_workflow_with_timeout(self):
        """Test building workflow with timeout."""
        workflow = (WorkflowBuilder("wf1", "Test")
            .timeout(60000)
            .step("step1", "Step 1", ActionType.TASK, "log")
            .build())

        assert workflow.timeout_ms == 60000


# ==================== Global Instance Tests ====================

class TestGlobalInstances:
    """Tests for global workflow engine instances."""

    def test_get_engine_none(self):
        """Test get engine returns None initially."""
        reset_workflow_engine()
        assert get_workflow_engine() is None

    def test_set_and_get_engine(self):
        """Test setting and getting engine."""
        reset_workflow_engine()
        engine = WorkflowEngine()
        set_workflow_engine(engine)
        assert get_workflow_engine() is engine

    def test_reset_engine(self):
        """Test resetting engine."""
        engine = WorkflowEngine()
        set_workflow_engine(engine)
        reset_workflow_engine()
        assert get_workflow_engine() is None


# ==================== Integration Tests ====================

class TestIntegration:
    """Integration tests for workflow system."""

    def test_complete_workflow_execution(self):
        """Test complete workflow execution."""
        engine = WorkflowEngine()

        # Build workflow
        workflow = (WorkflowBuilder("approval_flow", "Approval Workflow")
            .on_event("t1", "request.submitted")
            .step("review", "Review Request", ActionType.TASK, "log", {"message": "Reviewing"})
            .then("approve", ConditionGroup(conditions=[
                Condition("last_result.logged", ConditionOperator.EQUALS, True)
            ]))
            .step("approve", "Approve", ActionType.TASK, "log", {"message": "Approved"})
            .build())

        errors = engine.register_workflow(workflow)
        assert len(errors) == 0

        # Run workflow
        instance = engine.run_workflow("approval_flow", {"request_id": "req1"})
        assert instance.status == WorkflowStatus.COMPLETED

    def test_conditional_branching_workflow(self):
        """Test workflow with conditional branching."""
        engine = WorkflowEngine()
        definition = WorkflowDefinition(id="branch_flow", name="Branching")

        # Review step with conditional transitions
        review_action = ActionConfig(
            type=ActionType.TASK,
            handler="set_variable",
            params={"name": "score", "value": 85}
        )
        review_step = WorkflowStep(
            id="review",
            name="Review",
            action=review_action,
            transitions=[
                Transition(
                    target_step="approve",
                    condition=ConditionGroup(conditions=[
                        Condition("score", ConditionOperator.GREATER_THAN, 80)
                    ]),
                    priority=1
                ),
                Transition(target_step="reject", priority=0),
            ]
        )

        approve_action = ActionConfig(type=ActionType.TASK, handler="log", params={"message": "Approved"})
        reject_action = ActionConfig(type=ActionType.TASK, handler="log", params={"message": "Rejected"})

        definition.add_step(review_step)
        definition.add_step(WorkflowStep(id="approve", name="Approve", action=approve_action))
        definition.add_step(WorkflowStep(id="reject", name="Reject", action=reject_action))

        engine.register_workflow(definition)
        instance = engine.run_workflow("branch_flow")

        assert instance.status == WorkflowStatus.COMPLETED
        # Should have taken approve path
        assert "approve" in instance.step_executions

    def test_event_triggered_workflow(self):
        """Test event-triggered workflow."""
        engine = WorkflowEngine()

        definition = WorkflowDefinition(id="event_flow", name="Event Flow")
        definition.triggers.append(Trigger(
            id="t1",
            type=TriggerType.EVENT,
            event_name="order.placed",
            condition=ConditionGroup(conditions=[
                Condition("total", ConditionOperator.GREATER_THAN, 100)
            ])
        ))
        action = ActionConfig(type=ActionType.TASK, handler="log", params={"message": "Processing"})
        definition.add_step(WorkflowStep(id="process", name="Process", action=action))

        engine.register_workflow(definition)

        # Low value order - should not trigger
        instances1 = engine.handle_event("order.placed", {"total": 50})
        assert len(instances1) == 0

        # High value order - should trigger
        instances2 = engine.handle_event("order.placed", {"total": 150})
        assert len(instances2) == 1

    def test_workflow_with_custom_handler(self):
        """Test workflow with custom action handler."""
        engine = WorkflowEngine()

        results = []

        def custom_process(params, context):
            results.append(params.get("item"))
            return {"processed": params.get("item")}

        engine.register_handler("custom_process", custom_process)

        definition = WorkflowDefinition(id="custom_flow", name="Custom")
        action = ActionConfig(
            type=ActionType.TASK,
            handler="custom_process",
            params={"item": "test_item"}
        )
        definition.add_step(WorkflowStep(id="process", name="Process", action=action))

        engine.register_workflow(definition)
        engine.run_workflow("custom_flow")

        assert "test_item" in results

    def test_workflow_failure_handling(self):
        """Test workflow failure handling."""
        engine = WorkflowEngine()

        def failing_action(params, context):
            raise Exception("Action failed")

        engine.register_handler("failing", failing_action)

        definition = WorkflowDefinition(id="fail_flow", name="Failing")
        action = ActionConfig(
            type=ActionType.TASK,
            handler="failing",
            retry_count=1,
            retry_delay_ms=10
        )
        definition.add_step(WorkflowStep(id="step1", name="Step 1", action=action))

        engine.register_workflow(definition)
        instance = engine.run_workflow("fail_flow")

        assert instance.status == WorkflowStatus.FAILED
        assert instance.error == "Action failed"
