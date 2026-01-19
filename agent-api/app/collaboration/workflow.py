"""
Workflow Automation Module

Implements workflow engine with:
- Workflow definition with steps and transitions
- Event-based triggers and scheduling
- Conditional routing with rule evaluation
- Action execution with retry logic
- State persistence and recovery
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Union
import re
import time


# ==================== Enums ====================

class WorkflowStatus(Enum):
    """Status of a workflow instance."""
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(Enum):
    """Status of a workflow step."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    WAITING = "waiting"


class TriggerType(Enum):
    """Type of workflow trigger."""
    MANUAL = "manual"
    EVENT = "event"
    SCHEDULE = "schedule"
    CONDITION = "condition"
    WEBHOOK = "webhook"


class ActionType(Enum):
    """Type of workflow action."""
    TASK = "task"
    NOTIFICATION = "notification"
    API_CALL = "api_call"
    DATA_TRANSFORM = "data_transform"
    CONDITIONAL = "conditional"
    PARALLEL = "parallel"
    WAIT = "wait"
    SUBPROCESS = "subprocess"


class ConditionOperator(Enum):
    """Operators for condition evaluation."""
    EQUALS = "eq"
    NOT_EQUALS = "ne"
    GREATER_THAN = "gt"
    LESS_THAN = "lt"
    GREATER_OR_EQUAL = "gte"
    LESS_OR_EQUAL = "lte"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    MATCHES = "matches"
    IN = "in"
    NOT_IN = "not_in"
    IS_NULL = "is_null"
    IS_NOT_NULL = "is_not_null"


class LogicalOperator(Enum):
    """Logical operators for combining conditions."""
    AND = "and"
    OR = "or"
    NOT = "not"


# ==================== Data Classes ====================

@dataclass
class Condition:
    """A single condition for evaluation."""
    field: str
    operator: ConditionOperator
    value: Any = None

    def evaluate(self, context: Dict[str, Any]) -> bool:
        """Evaluate the condition against context."""
        field_value = self._get_field_value(context, self.field)

        if self.operator == ConditionOperator.IS_NULL:
            return field_value is None
        if self.operator == ConditionOperator.IS_NOT_NULL:
            return field_value is not None

        if field_value is None:
            return False

        if self.operator == ConditionOperator.EQUALS:
            return field_value == self.value
        elif self.operator == ConditionOperator.NOT_EQUALS:
            return field_value != self.value
        elif self.operator == ConditionOperator.GREATER_THAN:
            return field_value > self.value
        elif self.operator == ConditionOperator.LESS_THAN:
            return field_value < self.value
        elif self.operator == ConditionOperator.GREATER_OR_EQUAL:
            return field_value >= self.value
        elif self.operator == ConditionOperator.LESS_OR_EQUAL:
            return field_value <= self.value
        elif self.operator == ConditionOperator.CONTAINS:
            return self.value in field_value
        elif self.operator == ConditionOperator.NOT_CONTAINS:
            return self.value not in field_value
        elif self.operator == ConditionOperator.STARTS_WITH:
            return str(field_value).startswith(str(self.value))
        elif self.operator == ConditionOperator.ENDS_WITH:
            return str(field_value).endswith(str(self.value))
        elif self.operator == ConditionOperator.MATCHES:
            return bool(re.match(str(self.value), str(field_value)))
        elif self.operator == ConditionOperator.IN:
            return field_value in self.value
        elif self.operator == ConditionOperator.NOT_IN:
            return field_value not in self.value

        return False

    def _get_field_value(self, context: Dict[str, Any], field_path: str) -> Any:
        """Get nested field value using dot notation."""
        parts = field_path.split(".")
        value = context
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None
        return value


@dataclass
class ConditionGroup:
    """A group of conditions combined with logical operators."""
    conditions: List[Union[Condition, "ConditionGroup"]] = field(default_factory=list)
    operator: LogicalOperator = LogicalOperator.AND

    def evaluate(self, context: Dict[str, Any]) -> bool:
        """Evaluate the condition group."""
        if not self.conditions:
            return True

        results = [c.evaluate(context) for c in self.conditions]

        if self.operator == LogicalOperator.AND:
            return all(results)
        elif self.operator == LogicalOperator.OR:
            return any(results)
        elif self.operator == LogicalOperator.NOT:
            return not results[0] if results else True

        return False


@dataclass
class Trigger:
    """Workflow trigger definition."""
    id: str
    type: TriggerType
    name: str = ""
    event_name: Optional[str] = None  # For EVENT type
    schedule: Optional[str] = None  # Cron expression for SCHEDULE
    condition: Optional[ConditionGroup] = None  # For CONDITION type
    webhook_path: Optional[str] = None  # For WEBHOOK type
    enabled: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)

    def matches_event(self, event_name: str, event_data: Dict[str, Any]) -> bool:
        """Check if trigger matches an event."""
        if not self.enabled:
            return False
        if self.type != TriggerType.EVENT:
            return False
        if self.event_name != event_name:
            return False
        if self.condition and not self.condition.evaluate(event_data):
            return False
        return True


@dataclass
class ActionConfig:
    """Configuration for a workflow action."""
    type: ActionType
    handler: Optional[str] = None  # Handler function name
    params: Dict[str, Any] = field(default_factory=dict)
    timeout_ms: int = 30000
    retry_count: int = 3
    retry_delay_ms: int = 1000
    on_error: str = "fail"  # fail, continue, retry


@dataclass
class Transition:
    """Transition between workflow steps."""
    target_step: str
    condition: Optional[ConditionGroup] = None
    priority: int = 0  # Higher priority evaluated first


@dataclass
class WorkflowStep:
    """A step in the workflow."""
    id: str
    name: str
    action: ActionConfig
    transitions: List[Transition] = field(default_factory=list)
    timeout_ms: int = 60000
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_next_step(self, context: Dict[str, Any]) -> Optional[str]:
        """Determine the next step based on conditions."""
        # Sort by priority descending
        sorted_transitions = sorted(
            self.transitions,
            key=lambda t: t.priority,
            reverse=True
        )

        for transition in sorted_transitions:
            if transition.condition is None:
                return transition.target_step
            if transition.condition.evaluate(context):
                return transition.target_step

        return None


@dataclass
class WorkflowDefinition:
    """Complete workflow definition."""
    id: str
    name: str
    version: str = "1.0.0"
    description: str = ""
    steps: Dict[str, WorkflowStep] = field(default_factory=dict)
    triggers: List[Trigger] = field(default_factory=list)
    initial_step: str = ""
    input_schema: Dict[str, Any] = field(default_factory=dict)
    output_schema: Dict[str, Any] = field(default_factory=dict)
    timeout_ms: int = 3600000  # 1 hour default
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def add_step(self, step: WorkflowStep) -> None:
        """Add a step to the workflow."""
        self.steps[step.id] = step
        if not self.initial_step:
            self.initial_step = step.id

    def get_step(self, step_id: str) -> Optional[WorkflowStep]:
        """Get a step by ID."""
        return self.steps.get(step_id)

    def validate(self) -> List[str]:
        """Validate the workflow definition."""
        errors = []

        if not self.id:
            errors.append("Workflow ID is required")
        if not self.name:
            errors.append("Workflow name is required")
        if not self.steps:
            errors.append("Workflow must have at least one step")
        if self.initial_step and self.initial_step not in self.steps:
            errors.append(f"Initial step '{self.initial_step}' not found")

        # Check all transition targets exist
        for step_id, step in self.steps.items():
            for transition in step.transitions:
                if transition.target_step not in self.steps:
                    errors.append(
                        f"Step '{step_id}' has invalid transition target: "
                        f"'{transition.target_step}'"
                    )

        return errors


@dataclass
class StepExecution:
    """Execution state of a single step."""
    step_id: str
    status: StepStatus = StepStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    attempt: int = 0
    result: Optional[Any] = None
    error: Optional[str] = None

    @property
    def duration_ms(self) -> Optional[int]:
        """Get step execution duration in milliseconds."""
        if self.started_at and self.completed_at:
            return int((self.completed_at - self.started_at).total_seconds() * 1000)
        return None


@dataclass
class WorkflowInstance:
    """A running instance of a workflow."""
    id: str
    workflow_id: str
    status: WorkflowStatus = WorkflowStatus.ACTIVE
    current_step: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)
    input_data: Dict[str, Any] = field(default_factory=dict)
    output_data: Dict[str, Any] = field(default_factory=dict)
    step_executions: Dict[str, StepExecution] = field(default_factory=dict)
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    triggered_by: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def duration_ms(self) -> Optional[int]:
        """Get total workflow duration in milliseconds."""
        if self.completed_at:
            return int((self.completed_at - self.started_at).total_seconds() * 1000)
        return int((datetime.utcnow() - self.started_at).total_seconds() * 1000)

    def get_step_execution(self, step_id: str) -> Optional[StepExecution]:
        """Get step execution by ID."""
        return self.step_executions.get(step_id)

    def set_step_execution(self, execution: StepExecution) -> None:
        """Set step execution."""
        self.step_executions[execution.step_id] = execution


@dataclass
class ActionResult:
    """Result of executing an action."""
    success: bool
    result: Any = None
    error: Optional[str] = None
    duration_ms: int = 0
    retry_count: int = 0


@dataclass
class WorkflowConfig:
    """Configuration for workflow engine."""
    max_concurrent_workflows: int = 100
    max_step_retries: int = 3
    default_step_timeout_ms: int = 60000
    default_action_timeout_ms: int = 30000
    enable_persistence: bool = True
    enable_metrics: bool = True
    cleanup_completed_after_ms: int = 86400000  # 24 hours


# ==================== Condition Evaluator ====================

class ConditionEvaluator:
    """Evaluates conditions and condition groups."""

    def __init__(self):
        self._custom_operators: Dict[str, Callable] = {}

    def register_operator(
        self,
        name: str,
        evaluator: Callable[[Any, Any], bool]
    ) -> None:
        """Register a custom operator."""
        self._custom_operators[name] = evaluator

    def evaluate(
        self,
        condition: Union[Condition, ConditionGroup],
        context: Dict[str, Any]
    ) -> bool:
        """Evaluate a condition or condition group."""
        return condition.evaluate(context)

    def evaluate_expression(
        self,
        expression: str,
        context: Dict[str, Any]
    ) -> bool:
        """Evaluate a simple expression string."""
        # Support simple expressions like "status == 'approved'"
        # This is a simplified parser
        match = re.match(
            r"(\w+(?:\.\w+)*)\s*(==|!=|>=|<=|>|<)\s*['\"]?([^'\"]+)['\"]?",
            expression.strip()
        )
        if not match:
            return False

        field, op, value = match.groups()

        # Try to convert value to appropriate type
        try:
            if "." in value:
                value = float(value)
            else:
                value = int(value)
        except ValueError:
            pass  # Keep as string

        op_map = {
            "==": ConditionOperator.EQUALS,
            "!=": ConditionOperator.NOT_EQUALS,
            ">": ConditionOperator.GREATER_THAN,
            "<": ConditionOperator.LESS_THAN,
            ">=": ConditionOperator.GREATER_OR_EQUAL,
            "<=": ConditionOperator.LESS_OR_EQUAL,
        }

        condition = Condition(field, op_map.get(op, ConditionOperator.EQUALS), value)
        return condition.evaluate(context)


# ==================== Action Executor ====================

class ActionExecutor:
    """Executes workflow actions with retry logic."""

    def __init__(self, config: Optional[WorkflowConfig] = None):
        self.config = config or WorkflowConfig()
        self._handlers: Dict[str, Callable] = {}
        self._register_default_handlers()

    def _register_default_handlers(self) -> None:
        """Register default action handlers."""
        self._handlers["log"] = self._handle_log
        self._handlers["set_variable"] = self._handle_set_variable
        self._handlers["wait"] = self._handle_wait
        self._handlers["transform"] = self._handle_transform

    def register_handler(
        self,
        name: str,
        handler: Callable[[Dict[str, Any], Dict[str, Any]], Any]
    ) -> None:
        """Register a custom action handler."""
        self._handlers[name] = handler

    def execute(
        self,
        action: ActionConfig,
        context: Dict[str, Any]
    ) -> ActionResult:
        """Execute an action with retry logic."""
        start_time = time.time()
        last_error = None

        for attempt in range(action.retry_count + 1):
            try:
                result = self._execute_once(action, context)
                duration = int((time.time() - start_time) * 1000)
                return ActionResult(
                    success=True,
                    result=result,
                    duration_ms=duration,
                    retry_count=attempt
                )
            except Exception as e:
                last_error = str(e)
                if attempt < action.retry_count:
                    time.sleep(action.retry_delay_ms / 1000)

        duration = int((time.time() - start_time) * 1000)
        return ActionResult(
            success=False,
            error=last_error,
            duration_ms=duration,
            retry_count=action.retry_count
        )

    def _execute_once(
        self,
        action: ActionConfig,
        context: Dict[str, Any]
    ) -> Any:
        """Execute action once without retry."""
        handler_name = action.handler
        if not handler_name:
            handler_name = action.type.value

        handler = self._handlers.get(handler_name)
        if not handler:
            raise ValueError(f"Unknown action handler: {handler_name}")

        return handler(action.params, context)

    def _handle_log(
        self,
        params: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle log action."""
        message = params.get("message", "")
        level = params.get("level", "info")
        return {"logged": True, "message": message, "level": level}

    def _handle_set_variable(
        self,
        params: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle set variable action."""
        name = params.get("name", "")
        value = params.get("value")
        context[name] = value
        return {"variable": name, "value": value}

    def _handle_wait(
        self,
        params: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle wait action."""
        duration_ms = params.get("duration_ms", 1000)
        time.sleep(duration_ms / 1000)
        return {"waited_ms": duration_ms}

    def _handle_transform(
        self,
        params: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle data transform action."""
        source = params.get("source", "")
        target = params.get("target", "")
        transform = params.get("transform", "copy")

        # Get source value
        source_value = context.get(source)

        # Apply transform
        if transform == "copy":
            result = source_value
        elif transform == "uppercase":
            result = str(source_value).upper() if source_value else None
        elif transform == "lowercase":
            result = str(source_value).lower() if source_value else None
        elif transform == "json":
            import json
            result = json.dumps(source_value) if source_value else None
        else:
            result = source_value

        if target:
            context[target] = result

        return {"source": source, "target": target, "result": result}


# ==================== Trigger Manager ====================

class TriggerManager:
    """Manages workflow triggers."""

    def __init__(self):
        self._triggers: Dict[str, List[Trigger]] = {}  # workflow_id -> triggers
        self._event_handlers: Dict[str, List[str]] = {}  # event_name -> workflow_ids
        self._schedule_callbacks: List[Callable] = []

    def register_trigger(self, workflow_id: str, trigger: Trigger) -> None:
        """Register a trigger for a workflow."""
        if workflow_id not in self._triggers:
            self._triggers[workflow_id] = []
        self._triggers[workflow_id].append(trigger)

        # Index by event name for fast lookup
        if trigger.type == TriggerType.EVENT and trigger.event_name:
            if trigger.event_name not in self._event_handlers:
                self._event_handlers[trigger.event_name] = []
            if workflow_id not in self._event_handlers[trigger.event_name]:
                self._event_handlers[trigger.event_name].append(workflow_id)

    def unregister_trigger(self, workflow_id: str, trigger_id: str) -> bool:
        """Unregister a trigger."""
        if workflow_id not in self._triggers:
            return False

        triggers = self._triggers[workflow_id]
        for i, trigger in enumerate(triggers):
            if trigger.id == trigger_id:
                triggers.pop(i)
                return True
        return False

    def get_triggers(self, workflow_id: str) -> List[Trigger]:
        """Get all triggers for a workflow."""
        return self._triggers.get(workflow_id, [])

    def find_matching_workflows(
        self,
        event_name: str,
        event_data: Dict[str, Any]
    ) -> List[str]:
        """Find workflows that should be triggered by an event."""
        matching = []
        workflow_ids = self._event_handlers.get(event_name, [])

        for workflow_id in workflow_ids:
            triggers = self._triggers.get(workflow_id, [])
            for trigger in triggers:
                if trigger.matches_event(event_name, event_data):
                    matching.append(workflow_id)
                    break  # Only add workflow once

        return matching

    def enable_trigger(self, workflow_id: str, trigger_id: str) -> bool:
        """Enable a trigger."""
        return self._set_trigger_enabled(workflow_id, trigger_id, True)

    def disable_trigger(self, workflow_id: str, trigger_id: str) -> bool:
        """Disable a trigger."""
        return self._set_trigger_enabled(workflow_id, trigger_id, False)

    def _set_trigger_enabled(
        self,
        workflow_id: str,
        trigger_id: str,
        enabled: bool
    ) -> bool:
        """Set trigger enabled state."""
        triggers = self._triggers.get(workflow_id, [])
        for trigger in triggers:
            if trigger.id == trigger_id:
                trigger.enabled = enabled
                return True
        return False


# ==================== Conditional Router ====================

class ConditionalRouter:
    """Routes workflow execution based on conditions."""

    def __init__(self):
        self._evaluator = ConditionEvaluator()
        self._routes: Dict[str, List[Transition]] = {}  # step_id -> transitions

    def add_route(
        self,
        from_step: str,
        to_step: str,
        condition: Optional[ConditionGroup] = None,
        priority: int = 0
    ) -> None:
        """Add a route between steps."""
        if from_step not in self._routes:
            self._routes[from_step] = []

        transition = Transition(
            target_step=to_step,
            condition=condition,
            priority=priority
        )
        self._routes[from_step].append(transition)

    def get_next_step(
        self,
        current_step: str,
        context: Dict[str, Any]
    ) -> Optional[str]:
        """Determine the next step based on conditions."""
        transitions = self._routes.get(current_step, [])

        # Sort by priority descending
        sorted_transitions = sorted(
            transitions,
            key=lambda t: t.priority,
            reverse=True
        )

        for transition in sorted_transitions:
            if transition.condition is None:
                return transition.target_step
            if self._evaluator.evaluate(transition.condition, context):
                return transition.target_step

        return None

    def evaluate_condition(
        self,
        condition: Union[Condition, ConditionGroup],
        context: Dict[str, Any]
    ) -> bool:
        """Evaluate a condition."""
        return self._evaluator.evaluate(condition, context)


# ==================== Workflow Engine ====================

class WorkflowEngine:
    """Main workflow execution engine."""

    def __init__(self, config: Optional[WorkflowConfig] = None):
        self.config = config or WorkflowConfig()
        self._definitions: Dict[str, WorkflowDefinition] = {}
        self._instances: Dict[str, WorkflowInstance] = {}
        self._executor = ActionExecutor(self.config)
        self._trigger_manager = TriggerManager()
        self._router = ConditionalRouter()
        self._instance_counter = 0
        self._callbacks: Dict[str, List[Callable]] = {
            "workflow_started": [],
            "workflow_completed": [],
            "workflow_failed": [],
            "step_started": [],
            "step_completed": [],
            "step_failed": [],
        }

    def register_workflow(self, definition: WorkflowDefinition) -> List[str]:
        """Register a workflow definition."""
        errors = definition.validate()
        if errors:
            return errors

        self._definitions[definition.id] = definition

        # Register triggers
        for trigger in definition.triggers:
            self._trigger_manager.register_trigger(definition.id, trigger)

        # Register routes from step transitions
        for step_id, step in definition.steps.items():
            for transition in step.transitions:
                self._router.add_route(
                    step_id,
                    transition.target_step,
                    transition.condition,
                    transition.priority
                )

        return []

    def unregister_workflow(self, workflow_id: str) -> bool:
        """Unregister a workflow definition."""
        if workflow_id not in self._definitions:
            return False
        del self._definitions[workflow_id]
        return True

    def get_workflow(self, workflow_id: str) -> Optional[WorkflowDefinition]:
        """Get a workflow definition."""
        return self._definitions.get(workflow_id)

    def start_workflow(
        self,
        workflow_id: str,
        input_data: Optional[Dict[str, Any]] = None,
        triggered_by: Optional[str] = None
    ) -> Optional[WorkflowInstance]:
        """Start a new workflow instance."""
        definition = self._definitions.get(workflow_id)
        if not definition:
            return None

        # Check concurrent workflow limit
        active_count = sum(
            1 for inst in self._instances.values()
            if inst.status == WorkflowStatus.ACTIVE
        )
        if active_count >= self.config.max_concurrent_workflows:
            return None

        # Create instance with unique ID
        self._instance_counter += 1
        instance_id = f"wfi_{workflow_id}_{int(time.time() * 1000)}_{self._instance_counter}"
        instance = WorkflowInstance(
            id=instance_id,
            workflow_id=workflow_id,
            current_step=definition.initial_step,
            input_data=input_data or {},
            context={"input": input_data or {}},
            triggered_by=triggered_by
        )

        self._instances[instance_id] = instance
        self._emit_event("workflow_started", instance)

        return instance

    def execute_step(self, instance_id: str) -> Optional[StepExecution]:
        """Execute the current step of a workflow instance."""
        instance = self._instances.get(instance_id)
        if not instance or instance.status != WorkflowStatus.ACTIVE:
            return None

        definition = self._definitions.get(instance.workflow_id)
        if not definition:
            return None

        step = definition.get_step(instance.current_step)
        if not step:
            return None

        # Create step execution
        execution = StepExecution(
            step_id=step.id,
            status=StepStatus.RUNNING,
            started_at=datetime.utcnow()
        )
        instance.set_step_execution(execution)
        self._emit_event("step_started", instance, execution)

        # Execute action
        result = self._executor.execute(step.action, instance.context)

        execution.completed_at = datetime.utcnow()
        execution.attempt = result.retry_count + 1

        if result.success:
            execution.status = StepStatus.COMPLETED
            execution.result = result.result

            # Update context with result
            instance.context["last_result"] = result.result

            self._emit_event("step_completed", instance, execution)

            # Determine next step
            next_step = step.get_next_step(instance.context)
            if next_step:
                instance.current_step = next_step
            else:
                # Workflow completed
                instance.status = WorkflowStatus.COMPLETED
                instance.completed_at = datetime.utcnow()
                instance.output_data = instance.context.get("output", {})
                self._emit_event("workflow_completed", instance)
        else:
            execution.status = StepStatus.FAILED
            execution.error = result.error

            self._emit_event("step_failed", instance, execution)

            # Handle error based on action config
            if step.action.on_error == "continue":
                next_step = step.get_next_step(instance.context)
                if next_step:
                    instance.current_step = next_step
                else:
                    instance.status = WorkflowStatus.COMPLETED
                    instance.completed_at = datetime.utcnow()
            else:
                instance.status = WorkflowStatus.FAILED
                instance.error = result.error
                instance.completed_at = datetime.utcnow()
                self._emit_event("workflow_failed", instance)

        return execution

    def run_workflow(
        self,
        workflow_id: str,
        input_data: Optional[Dict[str, Any]] = None
    ) -> Optional[WorkflowInstance]:
        """Start and run a workflow to completion."""
        instance = self.start_workflow(workflow_id, input_data)
        if not instance:
            return None

        definition = self._definitions.get(workflow_id)
        timeout_at = datetime.utcnow() + timedelta(
            milliseconds=definition.timeout_ms if definition else 3600000
        )

        while instance.status == WorkflowStatus.ACTIVE:
            if datetime.utcnow() > timeout_at:
                instance.status = WorkflowStatus.FAILED
                instance.error = "Workflow timeout"
                instance.completed_at = datetime.utcnow()
                break

            self.execute_step(instance.id)

        return instance

    def pause_workflow(self, instance_id: str) -> bool:
        """Pause a running workflow."""
        instance = self._instances.get(instance_id)
        if not instance or instance.status != WorkflowStatus.ACTIVE:
            return False
        instance.status = WorkflowStatus.PAUSED
        return True

    def resume_workflow(self, instance_id: str) -> bool:
        """Resume a paused workflow."""
        instance = self._instances.get(instance_id)
        if not instance or instance.status != WorkflowStatus.PAUSED:
            return False
        instance.status = WorkflowStatus.ACTIVE
        return True

    def cancel_workflow(self, instance_id: str) -> bool:
        """Cancel a workflow."""
        instance = self._instances.get(instance_id)
        if not instance:
            return False
        if instance.status in [WorkflowStatus.COMPLETED, WorkflowStatus.CANCELLED]:
            return False
        instance.status = WorkflowStatus.CANCELLED
        instance.completed_at = datetime.utcnow()
        return True

    def get_instance(self, instance_id: str) -> Optional[WorkflowInstance]:
        """Get a workflow instance."""
        return self._instances.get(instance_id)

    def get_active_instances(self, workflow_id: Optional[str] = None) -> List[WorkflowInstance]:
        """Get all active workflow instances."""
        instances = []
        for instance in self._instances.values():
            if instance.status == WorkflowStatus.ACTIVE:
                if workflow_id is None or instance.workflow_id == workflow_id:
                    instances.append(instance)
        return instances

    def handle_event(
        self,
        event_name: str,
        event_data: Dict[str, Any]
    ) -> List[WorkflowInstance]:
        """Handle an event and trigger matching workflows."""
        workflow_ids = self._trigger_manager.find_matching_workflows(
            event_name, event_data
        )

        instances = []
        for workflow_id in workflow_ids:
            instance = self.start_workflow(
                workflow_id,
                input_data=event_data,
                triggered_by=f"event:{event_name}"
            )
            if instance:
                instances.append(instance)

        return instances

    def register_handler(
        self,
        name: str,
        handler: Callable[[Dict[str, Any], Dict[str, Any]], Any]
    ) -> None:
        """Register a custom action handler."""
        self._executor.register_handler(name, handler)

    def on(self, event: str, callback: Callable) -> None:
        """Register a callback for workflow events."""
        if event in self._callbacks:
            self._callbacks[event].append(callback)

    def _emit_event(self, event: str, *args) -> None:
        """Emit a workflow event."""
        for callback in self._callbacks.get(event, []):
            try:
                callback(*args)
            except Exception:
                pass  # Don't let callback errors break workflow

    def get_stats(self) -> Dict[str, Any]:
        """Get workflow engine statistics."""
        status_counts = {}
        for instance in self._instances.values():
            status = instance.status.value
            status_counts[status] = status_counts.get(status, 0) + 1

        return {
            "total_definitions": len(self._definitions),
            "total_instances": len(self._instances),
            "status_counts": status_counts,
            "active_instances": status_counts.get("active", 0),
        }


# ==================== Global Instances ====================

_workflow_engine: Optional[WorkflowEngine] = None


def get_workflow_engine() -> Optional[WorkflowEngine]:
    """Get the global workflow engine."""
    return _workflow_engine


def set_workflow_engine(engine: WorkflowEngine) -> None:
    """Set the global workflow engine."""
    global _workflow_engine
    _workflow_engine = engine


def reset_workflow_engine() -> None:
    """Reset the global workflow engine."""
    global _workflow_engine
    _workflow_engine = None


# ==================== Workflow Builder ====================

class WorkflowBuilder:
    """Fluent builder for creating workflows."""

    def __init__(self, workflow_id: str, name: str):
        self._definition = WorkflowDefinition(id=workflow_id, name=name)
        self._current_step: Optional[str] = None

    def description(self, desc: str) -> "WorkflowBuilder":
        """Set workflow description."""
        self._definition.description = desc
        return self

    def version(self, version: str) -> "WorkflowBuilder":
        """Set workflow version."""
        self._definition.version = version
        return self

    def timeout(self, timeout_ms: int) -> "WorkflowBuilder":
        """Set workflow timeout."""
        self._definition.timeout_ms = timeout_ms
        return self

    def add_trigger(self, trigger: Trigger) -> "WorkflowBuilder":
        """Add a trigger."""
        self._definition.triggers.append(trigger)
        return self

    def on_event(
        self,
        trigger_id: str,
        event_name: str,
        condition: Optional[ConditionGroup] = None
    ) -> "WorkflowBuilder":
        """Add an event trigger."""
        trigger = Trigger(
            id=trigger_id,
            type=TriggerType.EVENT,
            event_name=event_name,
            condition=condition
        )
        self._definition.triggers.append(trigger)
        return self

    def step(
        self,
        step_id: str,
        name: str,
        action_type: ActionType,
        handler: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> "WorkflowBuilder":
        """Add a workflow step."""
        action = ActionConfig(
            type=action_type,
            handler=handler,
            params=params or {}
        )
        step = WorkflowStep(id=step_id, name=name, action=action)
        self._definition.add_step(step)
        self._current_step = step_id
        return self

    def then(
        self,
        next_step: str,
        condition: Optional[ConditionGroup] = None,
        priority: int = 0
    ) -> "WorkflowBuilder":
        """Add a transition from current step."""
        if self._current_step and self._current_step in self._definition.steps:
            transition = Transition(
                target_step=next_step,
                condition=condition,
                priority=priority
            )
            self._definition.steps[self._current_step].transitions.append(transition)
        return self

    def build(self) -> WorkflowDefinition:
        """Build the workflow definition."""
        return self._definition
