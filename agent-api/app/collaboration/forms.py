"""
Forms & Surveys module for SwissBrain.ai collaboration system.

This module provides enterprise form and survey features including:
- Custom form builder with various field types
- Surveys and polls with response collection
- Form templates and reusable components
- Response validation and scoring
- Analytics and reporting
- Conditional logic and branching
- Anonymous and identified responses
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union
import uuid
import re


class FormStatus(str, Enum):
    """Status of a form."""
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"
    ARCHIVED = "archived"


class FormType(str, Enum):
    """Type of form."""
    SURVEY = "survey"
    POLL = "poll"
    QUIZ = "quiz"
    FEEDBACK = "feedback"
    REGISTRATION = "registration"
    APPLICATION = "application"
    CUSTOM = "custom"


class FieldType(str, Enum):
    """Type of form field."""
    TEXT = "text"
    TEXTAREA = "textarea"
    NUMBER = "number"
    EMAIL = "email"
    PHONE = "phone"
    URL = "url"
    DATE = "date"
    TIME = "time"
    DATETIME = "datetime"
    SELECT = "select"
    MULTI_SELECT = "multi_select"
    RADIO = "radio"
    CHECKBOX = "checkbox"
    RATING = "rating"
    SCALE = "scale"
    FILE = "file"
    SIGNATURE = "signature"
    HIDDEN = "hidden"
    SECTION = "section"
    PAGE_BREAK = "page_break"


class ValidationRule(str, Enum):
    """Validation rules for fields."""
    REQUIRED = "required"
    MIN_LENGTH = "min_length"
    MAX_LENGTH = "max_length"
    MIN_VALUE = "min_value"
    MAX_VALUE = "max_value"
    PATTERN = "pattern"
    EMAIL = "email"
    URL = "url"
    PHONE = "phone"
    CUSTOM = "custom"


class ConditionOperator(str, Enum):
    """Operators for conditional logic."""
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"


class ResponseStatus(str, Enum):
    """Status of a form response."""
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    VALIDATED = "validated"
    REJECTED = "rejected"


@dataclass
class FieldOption:
    """An option for select/radio/checkbox fields."""
    id: str
    label: str
    value: str
    position: int = 0
    is_other: bool = False
    score: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "label": self.label,
            "value": self.value,
            "position": self.position,
            "is_other": self.is_other,
            "score": self.score,
        }


@dataclass
class FieldValidation:
    """Validation configuration for a field."""
    rule: ValidationRule
    value: Any = None
    message: str = ""

    def validate(self, input_value: Any) -> bool:
        """Validate the input value."""
        if self.rule == ValidationRule.REQUIRED:
            if input_value is None:
                return False
            if isinstance(input_value, str) and not input_value.strip():
                return False
            if isinstance(input_value, list) and len(input_value) == 0:
                return False
            return True

        if input_value is None or input_value == "":
            return True  # Non-required empty values are valid

        if self.rule == ValidationRule.MIN_LENGTH:
            return len(str(input_value)) >= self.value

        if self.rule == ValidationRule.MAX_LENGTH:
            return len(str(input_value)) <= self.value

        if self.rule == ValidationRule.MIN_VALUE:
            try:
                return float(input_value) >= float(self.value)
            except (ValueError, TypeError):
                return False

        if self.rule == ValidationRule.MAX_VALUE:
            try:
                return float(input_value) <= float(self.value)
            except (ValueError, TypeError):
                return False

        if self.rule == ValidationRule.PATTERN:
            try:
                return bool(re.match(self.value, str(input_value)))
            except re.error:
                return False

        if self.rule == ValidationRule.EMAIL:
            pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            return bool(re.match(pattern, str(input_value)))

        if self.rule == ValidationRule.URL:
            pattern = r'^https?://[^\s/$.?#].[^\s]*$'
            return bool(re.match(pattern, str(input_value)))

        if self.rule == ValidationRule.PHONE:
            pattern = r'^[\d\s\-\+\(\)]+$'
            return bool(re.match(pattern, str(input_value)))

        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "rule": self.rule.value,
            "value": self.value,
            "message": self.message,
        }


@dataclass
class FieldCondition:
    """Conditional logic for showing/hiding a field."""
    source_field_id: str
    operator: ConditionOperator
    value: Any

    def evaluate(self, field_values: Dict[str, Any]) -> bool:
        """Evaluate the condition."""
        source_value = field_values.get(self.source_field_id)

        if self.operator == ConditionOperator.EQUALS:
            return source_value == self.value
        elif self.operator == ConditionOperator.NOT_EQUALS:
            return source_value != self.value
        elif self.operator == ConditionOperator.CONTAINS:
            if isinstance(source_value, str):
                return self.value in source_value
            if isinstance(source_value, list):
                return self.value in source_value
            return False
        elif self.operator == ConditionOperator.NOT_CONTAINS:
            if isinstance(source_value, str):
                return self.value not in source_value
            if isinstance(source_value, list):
                return self.value not in source_value
            return True
        elif self.operator == ConditionOperator.GREATER_THAN:
            try:
                return float(source_value) > float(self.value)
            except (ValueError, TypeError):
                return False
        elif self.operator == ConditionOperator.LESS_THAN:
            try:
                return float(source_value) < float(self.value)
            except (ValueError, TypeError):
                return False
        elif self.operator == ConditionOperator.IS_EMPTY:
            return source_value is None or source_value == "" or source_value == []
        elif self.operator == ConditionOperator.IS_NOT_EMPTY:
            return source_value is not None and source_value != "" and source_value != []

        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "source_field_id": self.source_field_id,
            "operator": self.operator.value,
            "value": self.value,
        }


@dataclass
class FormField:
    """A field in a form."""
    id: str
    form_id: str
    field_type: FieldType
    label: str
    name: str
    position: int = 0
    description: str = ""
    placeholder: str = ""
    default_value: Any = None
    options: List[FieldOption] = field(default_factory=list)
    validations: List[FieldValidation] = field(default_factory=list)
    conditions: List[FieldCondition] = field(default_factory=list)
    is_required: bool = False
    is_hidden: bool = False
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    step: Optional[float] = None
    max_file_size: Optional[int] = None
    allowed_file_types: Set[str] = field(default_factory=set)
    settings: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Add required validation if needed."""
        if self.is_required:
            has_required = any(v.rule == ValidationRule.REQUIRED for v in self.validations)
            if not has_required:
                self.validations.insert(0, FieldValidation(
                    rule=ValidationRule.REQUIRED,
                    message=f"{self.label} is required"
                ))

    def validate_value(self, value: Any) -> List[str]:
        """Validate a value against all validations."""
        errors = []
        for validation in self.validations:
            if not validation.validate(value):
                errors.append(validation.message or f"Validation failed: {validation.rule.value}")
        return errors

    def should_show(self, field_values: Dict[str, Any]) -> bool:
        """Check if field should be shown based on conditions."""
        if not self.conditions:
            return True
        return all(condition.evaluate(field_values) for condition in self.conditions)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "form_id": self.form_id,
            "field_type": self.field_type.value,
            "label": self.label,
            "name": self.name,
            "position": self.position,
            "description": self.description,
            "placeholder": self.placeholder,
            "default_value": self.default_value,
            "options": [o.to_dict() for o in self.options],
            "validations": [v.to_dict() for v in self.validations],
            "conditions": [c.to_dict() for c in self.conditions],
            "is_required": self.is_required,
            "is_hidden": self.is_hidden,
            "min_value": self.min_value,
            "max_value": self.max_value,
            "step": self.step,
            "settings": self.settings,
        }


@dataclass
class Form:
    """A form or survey."""
    id: str
    title: str
    creator_id: str
    form_type: FormType = FormType.SURVEY
    status: FormStatus = FormStatus.DRAFT
    description: str = ""
    workspace_id: Optional[str] = None
    project_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    response_limit: Optional[int] = None
    allow_anonymous: bool = False
    allow_multiple_responses: bool = False
    show_progress: bool = True
    shuffle_questions: bool = False
    require_login: bool = True
    confirmation_message: str = "Thank you for your response!"
    redirect_url: str = ""
    notification_emails: List[str] = field(default_factory=list)
    tags: Set[str] = field(default_factory=set)
    settings: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_open(self) -> bool:
        """Check if form is accepting responses."""
        if self.status != FormStatus.PUBLISHED:
            return False
        now = datetime.utcnow()
        if self.starts_at and now < self.starts_at:
            return False
        if self.ends_at and now > self.ends_at:
            return False
        return True

    def publish(self) -> None:
        """Publish the form."""
        self.status = FormStatus.PUBLISHED
        self.published_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def close(self) -> None:
        """Close the form."""
        self.status = FormStatus.CLOSED
        self.closed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def archive(self) -> None:
        """Archive the form."""
        self.status = FormStatus.ARCHIVED
        self.updated_at = datetime.utcnow()

    def reopen(self) -> None:
        """Reopen a closed form."""
        self.status = FormStatus.PUBLISHED
        self.closed_at = None
        self.updated_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "creator_id": self.creator_id,
            "form_type": self.form_type.value,
            "status": self.status.value,
            "description": self.description,
            "workspace_id": self.workspace_id,
            "project_id": self.project_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "starts_at": self.starts_at.isoformat() if self.starts_at else None,
            "ends_at": self.ends_at.isoformat() if self.ends_at else None,
            "response_limit": self.response_limit,
            "allow_anonymous": self.allow_anonymous,
            "allow_multiple_responses": self.allow_multiple_responses,
            "show_progress": self.show_progress,
            "shuffle_questions": self.shuffle_questions,
            "require_login": self.require_login,
            "confirmation_message": self.confirmation_message,
            "redirect_url": self.redirect_url,
            "notification_emails": self.notification_emails,
            "tags": list(self.tags),
            "is_open": self.is_open,
            "settings": self.settings,
        }


@dataclass
class FieldResponse:
    """A response to a single field."""
    field_id: str
    value: Any
    is_valid: bool = True
    validation_errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "field_id": self.field_id,
            "value": self.value,
            "is_valid": self.is_valid,
            "validation_errors": self.validation_errors,
        }


@dataclass
class FormResponse:
    """A complete response to a form."""
    id: str
    form_id: str
    respondent_id: Optional[str] = None
    status: ResponseStatus = ResponseStatus.IN_PROGRESS
    field_responses: Dict[str, FieldResponse] = field(default_factory=dict)
    started_at: datetime = field(default_factory=datetime.utcnow)
    submitted_at: Optional[datetime] = None
    completion_time_seconds: Optional[int] = None
    ip_address: str = ""
    user_agent: str = ""
    score: Optional[float] = None
    max_score: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def set_field_value(self, field_id: str, value: Any) -> None:
        """Set a field value."""
        if field_id not in self.field_responses:
            self.field_responses[field_id] = FieldResponse(field_id=field_id, value=value)
        else:
            self.field_responses[field_id].value = value

    def get_field_value(self, field_id: str) -> Any:
        """Get a field value."""
        response = self.field_responses.get(field_id)
        return response.value if response else None

    def submit(self) -> None:
        """Submit the response."""
        self.status = ResponseStatus.SUBMITTED
        self.submitted_at = datetime.utcnow()
        if self.started_at:
            delta = self.submitted_at - self.started_at
            self.completion_time_seconds = int(delta.total_seconds())

    @property
    def is_complete(self) -> bool:
        """Check if response is submitted."""
        return self.status in (ResponseStatus.SUBMITTED, ResponseStatus.VALIDATED)

    @property
    def score_percentage(self) -> Optional[float]:
        """Get score as percentage."""
        if self.score is not None and self.max_score and self.max_score > 0:
            return (self.score / self.max_score) * 100
        return None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "form_id": self.form_id,
            "respondent_id": self.respondent_id,
            "status": self.status.value,
            "field_responses": {k: v.to_dict() for k, v in self.field_responses.items()},
            "started_at": self.started_at.isoformat(),
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "completion_time_seconds": self.completion_time_seconds,
            "score": self.score,
            "max_score": self.max_score,
            "score_percentage": self.score_percentage,
            "metadata": self.metadata,
        }


@dataclass
class FormTemplate:
    """A reusable form template."""
    id: str
    name: str
    description: str = ""
    form_type: FormType = FormType.SURVEY
    category: str = ""
    fields_config: List[Dict[str, Any]] = field(default_factory=list)
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
            "form_type": self.form_type.value,
            "category": self.category,
            "fields_config": self.fields_config,
            "settings": self.settings,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
            "is_system": self.is_system,
        }


@dataclass
class FormAnalytics:
    """Analytics for a form."""
    form_id: str
    total_views: int = 0
    total_starts: int = 0
    total_completions: int = 0
    avg_completion_time_seconds: float = 0
    completion_rate: float = 0
    field_analytics: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def calculate_completion_rate(self) -> None:
        """Calculate completion rate."""
        if self.total_starts > 0:
            self.completion_rate = (self.total_completions / self.total_starts) * 100
        else:
            self.completion_rate = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "form_id": self.form_id,
            "total_views": self.total_views,
            "total_starts": self.total_starts,
            "total_completions": self.total_completions,
            "avg_completion_time_seconds": self.avg_completion_time_seconds,
            "completion_rate": self.completion_rate,
            "field_analytics": self.field_analytics,
        }


class FormRegistry:
    """Registry for form entities."""

    def __init__(self) -> None:
        """Initialize the registry."""
        self._forms: Dict[str, Form] = {}
        self._fields: Dict[str, List[FormField]] = {}
        self._responses: Dict[str, List[FormResponse]] = {}
        self._templates: Dict[str, FormTemplate] = {}
        self._analytics: Dict[str, FormAnalytics] = {}

    # Form methods
    def create_form(
        self,
        title: str,
        creator_id: str,
        form_type: FormType = FormType.SURVEY,
        description: str = "",
        workspace_id: Optional[str] = None,
        project_id: Optional[str] = None,
        allow_anonymous: bool = False,
        allow_multiple_responses: bool = False,
        require_login: bool = True,
        tags: Optional[Set[str]] = None,
    ) -> Form:
        """Create a new form."""
        form_id = str(uuid.uuid4())
        form = Form(
            id=form_id,
            title=title,
            creator_id=creator_id,
            form_type=form_type,
            description=description,
            workspace_id=workspace_id,
            project_id=project_id,
            allow_anonymous=allow_anonymous,
            allow_multiple_responses=allow_multiple_responses,
            require_login=require_login,
            tags=tags or set(),
        )

        self._forms[form_id] = form
        self._fields[form_id] = []
        self._responses[form_id] = []
        self._analytics[form_id] = FormAnalytics(form_id=form_id)

        return form

    def get_form(self, form_id: str) -> Optional[Form]:
        """Get a form by ID."""
        return self._forms.get(form_id)

    def update_form(
        self,
        form_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        starts_at: Optional[datetime] = None,
        ends_at: Optional[datetime] = None,
        response_limit: Optional[int] = None,
        confirmation_message: Optional[str] = None,
        tags: Optional[Set[str]] = None,
    ) -> Optional[Form]:
        """Update a form."""
        form = self._forms.get(form_id)
        if not form:
            return None

        if title is not None:
            form.title = title
        if description is not None:
            form.description = description
        if starts_at is not None:
            form.starts_at = starts_at
        if ends_at is not None:
            form.ends_at = ends_at
        if response_limit is not None:
            form.response_limit = response_limit
        if confirmation_message is not None:
            form.confirmation_message = confirmation_message
        if tags is not None:
            form.tags = tags

        form.updated_at = datetime.utcnow()
        return form

    def delete_form(self, form_id: str) -> bool:
        """Delete a form."""
        if form_id not in self._forms:
            return False

        del self._forms[form_id]
        self._fields.pop(form_id, None)
        self._responses.pop(form_id, None)
        self._analytics.pop(form_id, None)

        return True

    def publish_form(self, form_id: str) -> Optional[Form]:
        """Publish a form."""
        form = self._forms.get(form_id)
        if form:
            form.publish()
        return form

    def close_form(self, form_id: str) -> Optional[Form]:
        """Close a form."""
        form = self._forms.get(form_id)
        if form:
            form.close()
        return form

    def list_forms(
        self,
        creator_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        form_type: Optional[FormType] = None,
        status: Optional[FormStatus] = None,
        tags: Optional[Set[str]] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Form]:
        """List forms with filters."""
        forms = list(self._forms.values())

        if creator_id:
            forms = [f for f in forms if f.creator_id == creator_id]
        if workspace_id:
            forms = [f for f in forms if f.workspace_id == workspace_id]
        if form_type:
            forms = [f for f in forms if f.form_type == form_type]
        if status:
            forms = [f for f in forms if f.status == status]
        if tags:
            forms = [f for f in forms if tags & f.tags]

        forms.sort(key=lambda f: f.created_at, reverse=True)
        return forms[offset:offset + limit]

    # Field methods
    def add_field(
        self,
        form_id: str,
        field_type: FieldType,
        label: str,
        name: Optional[str] = None,
        description: str = "",
        placeholder: str = "",
        default_value: Any = None,
        is_required: bool = False,
        options: Optional[List[Dict[str, Any]]] = None,
        validations: Optional[List[Dict[str, Any]]] = None,
        position: Optional[int] = None,
    ) -> Optional[FormField]:
        """Add a field to a form."""
        if form_id not in self._forms:
            return None

        field_id = str(uuid.uuid4())
        fields = self._fields.get(form_id, [])

        if position is None:
            position = len(fields)

        if not name:
            name = label.lower().replace(" ", "_")

        # Parse options
        field_options = []
        if options:
            for i, opt in enumerate(options):
                field_options.append(FieldOption(
                    id=opt.get("id", str(uuid.uuid4())),
                    label=opt.get("label", ""),
                    value=opt.get("value", opt.get("label", "")),
                    position=opt.get("position", i),
                    is_other=opt.get("is_other", False),
                    score=opt.get("score", 0),
                ))

        # Parse validations
        field_validations = []
        if validations:
            for val in validations:
                field_validations.append(FieldValidation(
                    rule=ValidationRule(val.get("rule", "required")),
                    value=val.get("value"),
                    message=val.get("message", ""),
                ))

        form_field = FormField(
            id=field_id,
            form_id=form_id,
            field_type=field_type,
            label=label,
            name=name,
            position=position,
            description=description,
            placeholder=placeholder,
            default_value=default_value,
            is_required=is_required,
            options=field_options,
            validations=field_validations,
        )

        fields.append(form_field)
        fields.sort(key=lambda f: f.position)
        self._fields[form_id] = fields

        return form_field

    def get_field(self, form_id: str, field_id: str) -> Optional[FormField]:
        """Get a field by ID."""
        fields = self._fields.get(form_id, [])
        for f in fields:
            if f.id == field_id:
                return f
        return None

    def update_field(
        self,
        form_id: str,
        field_id: str,
        label: Optional[str] = None,
        description: Optional[str] = None,
        placeholder: Optional[str] = None,
        is_required: Optional[bool] = None,
        position: Optional[int] = None,
    ) -> Optional[FormField]:
        """Update a field."""
        field = self.get_field(form_id, field_id)
        if not field:
            return None

        if label is not None:
            field.label = label
        if description is not None:
            field.description = description
        if placeholder is not None:
            field.placeholder = placeholder
        if is_required is not None:
            field.is_required = is_required
        if position is not None:
            field.position = position
            self._fields[form_id].sort(key=lambda f: f.position)

        return field

    def delete_field(self, form_id: str, field_id: str) -> bool:
        """Delete a field."""
        fields = self._fields.get(form_id, [])
        for i, f in enumerate(fields):
            if f.id == field_id:
                del fields[i]
                return True
        return False

    def get_fields(self, form_id: str) -> List[FormField]:
        """Get all fields for a form."""
        return self._fields.get(form_id, [])

    def reorder_fields(self, form_id: str, field_ids: List[str]) -> bool:
        """Reorder fields."""
        fields = self._fields.get(form_id, [])
        if not fields:
            return False

        field_map = {f.id: f for f in fields}
        reordered = []

        for i, fid in enumerate(field_ids):
            if fid in field_map:
                field_map[fid].position = i
                reordered.append(field_map[fid])

        self._fields[form_id] = reordered
        return True

    # Response methods
    def start_response(
        self,
        form_id: str,
        respondent_id: Optional[str] = None,
        ip_address: str = "",
        user_agent: str = "",
    ) -> Optional[FormResponse]:
        """Start a new form response."""
        form = self._forms.get(form_id)
        if not form or not form.is_open:
            return None

        # Check response limit
        if form.response_limit:
            responses = self._responses.get(form_id, [])
            completed = [r for r in responses if r.is_complete]
            if len(completed) >= form.response_limit:
                return None

        # Check multiple responses
        if not form.allow_multiple_responses and respondent_id:
            responses = self._responses.get(form_id, [])
            for r in responses:
                if r.respondent_id == respondent_id and r.is_complete:
                    return None

        response_id = str(uuid.uuid4())
        response = FormResponse(
            id=response_id,
            form_id=form_id,
            respondent_id=respondent_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        if form_id not in self._responses:
            self._responses[form_id] = []
        self._responses[form_id].append(response)

        # Update analytics
        analytics = self._analytics.get(form_id)
        if analytics:
            analytics.total_starts += 1

        return response

    def get_response(self, response_id: str) -> Optional[FormResponse]:
        """Get a response by ID."""
        for responses in self._responses.values():
            for r in responses:
                if r.id == response_id:
                    return r
        return None

    def save_response(
        self,
        response_id: str,
        field_values: Dict[str, Any],
    ) -> Optional[FormResponse]:
        """Save field values to a response."""
        response = self.get_response(response_id)
        if not response or response.is_complete:
            return None

        for field_id, value in field_values.items():
            response.set_field_value(field_id, value)

        return response

    def submit_response(self, response_id: str) -> Optional[FormResponse]:
        """Submit a response."""
        response = self.get_response(response_id)
        if not response or response.is_complete:
            return None

        form = self._forms.get(response.form_id)
        if not form:
            return None

        # Validate all required fields
        fields = self._fields.get(response.form_id, [])
        all_valid = True

        for field in fields:
            field_response = response.field_responses.get(field.id)
            value = field_response.value if field_response else None

            errors = field.validate_value(value)
            if errors:
                all_valid = False
                if field_response:
                    field_response.is_valid = False
                    field_response.validation_errors = errors
                else:
                    response.field_responses[field.id] = FieldResponse(
                        field_id=field.id,
                        value=value,
                        is_valid=False,
                        validation_errors=errors,
                    )

        if all_valid:
            response.submit()
            response.status = ResponseStatus.VALIDATED

            # Calculate score for quizzes
            if form.form_type == FormType.QUIZ:
                self._calculate_score(response)

            # Update analytics
            analytics = self._analytics.get(response.form_id)
            if analytics:
                analytics.total_completions += 1
                self._update_analytics(response.form_id)
        else:
            response.status = ResponseStatus.REJECTED

        return response

    def _calculate_score(self, response: FormResponse) -> None:
        """Calculate score for a quiz response."""
        fields = self._fields.get(response.form_id, [])
        total_score = 0
        max_score = 0

        for field in fields:
            if field.options:
                max_field_score = max(opt.score for opt in field.options)
                max_score += max_field_score

                field_response = response.field_responses.get(field.id)
                if field_response:
                    for opt in field.options:
                        if opt.value == field_response.value:
                            total_score += opt.score
                            break

        response.score = total_score
        response.max_score = max_score

    def _update_analytics(self, form_id: str) -> None:
        """Update form analytics."""
        analytics = self._analytics.get(form_id)
        if not analytics:
            return

        responses = self._responses.get(form_id, [])
        completed = [r for r in responses if r.is_complete and r.completion_time_seconds]

        if completed:
            total_time = sum(r.completion_time_seconds for r in completed)
            analytics.avg_completion_time_seconds = total_time / len(completed)

        analytics.calculate_completion_rate()

    def delete_response(self, response_id: str) -> bool:
        """Delete a response."""
        for form_id, responses in self._responses.items():
            for i, r in enumerate(responses):
                if r.id == response_id:
                    del responses[i]
                    return True
        return False

    def get_responses(
        self,
        form_id: str,
        status: Optional[ResponseStatus] = None,
        respondent_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[FormResponse]:
        """Get responses for a form."""
        responses = self._responses.get(form_id, [])

        if status:
            responses = [r for r in responses if r.status == status]
        if respondent_id:
            responses = [r for r in responses if r.respondent_id == respondent_id]

        responses.sort(key=lambda r: r.started_at, reverse=True)
        return responses[offset:offset + limit]

    def get_response_count(self, form_id: str) -> Dict[str, int]:
        """Get response counts by status."""
        responses = self._responses.get(form_id, [])
        counts = {status.value: 0 for status in ResponseStatus}

        for r in responses:
            counts[r.status.value] += 1

        counts["total"] = len(responses)
        return counts

    # Template methods
    def create_template(
        self,
        name: str,
        created_by: str,
        description: str = "",
        form_type: FormType = FormType.SURVEY,
        category: str = "",
        fields_config: Optional[List[Dict[str, Any]]] = None,
    ) -> FormTemplate:
        """Create a form template."""
        template_id = str(uuid.uuid4())
        template = FormTemplate(
            id=template_id,
            name=name,
            description=description,
            form_type=form_type,
            category=category,
            fields_config=fields_config or [],
            created_by=created_by,
        )

        self._templates[template_id] = template
        return template

    def get_template(self, template_id: str) -> Optional[FormTemplate]:
        """Get a template by ID."""
        return self._templates.get(template_id)

    def list_templates(
        self,
        form_type: Optional[FormType] = None,
        category: Optional[str] = None,
    ) -> List[FormTemplate]:
        """List templates."""
        templates = list(self._templates.values())

        if form_type:
            templates = [t for t in templates if t.form_type == form_type]
        if category:
            templates = [t for t in templates if t.category == category]

        return templates

    def create_form_from_template(
        self,
        template_id: str,
        title: str,
        creator_id: str,
        workspace_id: Optional[str] = None,
    ) -> Optional[Form]:
        """Create a form from a template."""
        template = self._templates.get(template_id)
        if not template:
            return None

        form = self.create_form(
            title=title,
            creator_id=creator_id,
            form_type=template.form_type,
            description=template.description,
            workspace_id=workspace_id,
        )

        # Add fields from template
        for field_config in template.fields_config:
            self.add_field(
                form_id=form.id,
                field_type=FieldType(field_config.get("field_type", "text")),
                label=field_config.get("label", ""),
                name=field_config.get("name"),
                description=field_config.get("description", ""),
                is_required=field_config.get("is_required", False),
                options=field_config.get("options"),
                validations=field_config.get("validations"),
            )

        return form

    def delete_template(self, template_id: str) -> bool:
        """Delete a template."""
        if template_id in self._templates:
            del self._templates[template_id]
            return True
        return False

    # Analytics methods
    def get_analytics(self, form_id: str) -> Optional[FormAnalytics]:
        """Get analytics for a form."""
        return self._analytics.get(form_id)

    def record_view(self, form_id: str) -> None:
        """Record a form view."""
        analytics = self._analytics.get(form_id)
        if analytics:
            analytics.total_views += 1

    def get_field_summary(self, form_id: str, field_id: str) -> Dict[str, Any]:
        """Get summary statistics for a field."""
        responses = self._responses.get(form_id, [])
        field = self.get_field(form_id, field_id)

        if not field:
            return {}

        values = []
        for response in responses:
            if response.is_complete:
                field_response = response.field_responses.get(field_id)
                if field_response and field_response.value is not None:
                    values.append(field_response.value)

        summary: Dict[str, Any] = {
            "field_id": field_id,
            "total_responses": len(values),
        }

        if not values:
            return summary

        # Calculate based on field type
        if field.field_type in (FieldType.SELECT, FieldType.RADIO, FieldType.CHECKBOX, FieldType.MULTI_SELECT):
            # Count option selections
            option_counts: Dict[str, int] = {}
            for value in values:
                if isinstance(value, list):
                    for v in value:
                        option_counts[str(v)] = option_counts.get(str(v), 0) + 1
                else:
                    option_counts[str(value)] = option_counts.get(str(value), 0) + 1

            summary["option_counts"] = option_counts
            summary["option_percentages"] = {
                k: (v / len(values)) * 100 for k, v in option_counts.items()
            }

        elif field.field_type in (FieldType.NUMBER, FieldType.RATING, FieldType.SCALE):
            # Calculate numeric statistics
            numeric_values = []
            for v in values:
                try:
                    numeric_values.append(float(v))
                except (ValueError, TypeError):
                    pass

            if numeric_values:
                summary["min"] = min(numeric_values)
                summary["max"] = max(numeric_values)
                summary["avg"] = sum(numeric_values) / len(numeric_values)
                summary["sum"] = sum(numeric_values)

        elif field.field_type in (FieldType.TEXT, FieldType.TEXTAREA):
            # Text statistics
            lengths = [len(str(v)) for v in values]
            summary["avg_length"] = sum(lengths) / len(lengths)
            summary["min_length"] = min(lengths)
            summary["max_length"] = max(lengths)

        return summary

    def get_stats(
        self,
        workspace_id: Optional[str] = None,
        creator_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get overall statistics."""
        forms = self.list_forms(workspace_id=workspace_id, creator_id=creator_id)

        total_responses = 0
        total_completions = 0

        for form in forms:
            responses = self._responses.get(form.id, [])
            total_responses += len(responses)
            total_completions += len([r for r in responses if r.is_complete])

        status_counts = {}
        for status in FormStatus:
            status_counts[status.value] = len([f for f in forms if f.status == status])

        return {
            "total_forms": len(forms),
            "total_responses": total_responses,
            "total_completions": total_completions,
            "forms_by_status": status_counts,
            "published_forms": status_counts.get(FormStatus.PUBLISHED.value, 0),
        }


class FormManager:
    """High-level API for form operations."""

    def __init__(self, registry: Optional[FormRegistry] = None) -> None:
        """Initialize the manager."""
        self._registry = registry or FormRegistry()

    @property
    def registry(self) -> FormRegistry:
        """Get the registry."""
        return self._registry

    # Form methods
    def create_form(
        self,
        title: str,
        creator_id: str,
        form_type: FormType = FormType.SURVEY,
        description: str = "",
        workspace_id: Optional[str] = None,
        allow_anonymous: bool = False,
        tags: Optional[Set[str]] = None,
    ) -> Form:
        """Create a new form."""
        return self._registry.create_form(
            title=title,
            creator_id=creator_id,
            form_type=form_type,
            description=description,
            workspace_id=workspace_id,
            allow_anonymous=allow_anonymous,
            tags=tags,
        )

    def create_poll(
        self,
        title: str,
        creator_id: str,
        question: str,
        options: List[str],
        allow_multiple: bool = False,
        workspace_id: Optional[str] = None,
    ) -> Form:
        """Create a simple poll."""
        form = self._registry.create_form(
            title=title,
            creator_id=creator_id,
            form_type=FormType.POLL,
            workspace_id=workspace_id,
        )

        field_type = FieldType.MULTI_SELECT if allow_multiple else FieldType.RADIO
        option_list = [{"label": opt, "value": opt} for opt in options]

        self._registry.add_field(
            form_id=form.id,
            field_type=field_type,
            label=question,
            is_required=True,
            options=option_list,
        )

        return form

    def create_quiz(
        self,
        title: str,
        creator_id: str,
        description: str = "",
        workspace_id: Optional[str] = None,
    ) -> Form:
        """Create a quiz form."""
        return self._registry.create_form(
            title=title,
            creator_id=creator_id,
            form_type=FormType.QUIZ,
            description=description,
            workspace_id=workspace_id,
        )

    def create_feedback_form(
        self,
        title: str,
        creator_id: str,
        workspace_id: Optional[str] = None,
    ) -> Form:
        """Create a feedback form with common fields."""
        form = self._registry.create_form(
            title=title,
            creator_id=creator_id,
            form_type=FormType.FEEDBACK,
            workspace_id=workspace_id,
            allow_anonymous=True,
        )

        # Add rating field
        self._registry.add_field(
            form_id=form.id,
            field_type=FieldType.RATING,
            label="Overall Rating",
            is_required=True,
        )

        # Add feedback text
        self._registry.add_field(
            form_id=form.id,
            field_type=FieldType.TEXTAREA,
            label="Your Feedback",
            placeholder="Please share your thoughts...",
        )

        return form

    def get_form(self, form_id: str) -> Optional[Form]:
        """Get a form."""
        return self._registry.get_form(form_id)

    def update_form(
        self,
        form_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        starts_at: Optional[datetime] = None,
        ends_at: Optional[datetime] = None,
    ) -> Optional[Form]:
        """Update a form."""
        return self._registry.update_form(
            form_id, title, description, starts_at, ends_at
        )

    def delete_form(self, form_id: str) -> bool:
        """Delete a form."""
        return self._registry.delete_form(form_id)

    def publish_form(self, form_id: str) -> Optional[Form]:
        """Publish a form."""
        return self._registry.publish_form(form_id)

    def close_form(self, form_id: str) -> Optional[Form]:
        """Close a form."""
        return self._registry.close_form(form_id)

    def list_forms(
        self,
        creator_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        form_type: Optional[FormType] = None,
        status: Optional[FormStatus] = None,
    ) -> List[Form]:
        """List forms."""
        return self._registry.list_forms(
            creator_id=creator_id,
            workspace_id=workspace_id,
            form_type=form_type,
            status=status,
        )

    # Field methods
    def add_field(
        self,
        form_id: str,
        field_type: FieldType,
        label: str,
        is_required: bool = False,
        description: str = "",
        placeholder: str = "",
        options: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[FormField]:
        """Add a field to a form."""
        return self._registry.add_field(
            form_id=form_id,
            field_type=field_type,
            label=label,
            is_required=is_required,
            description=description,
            placeholder=placeholder,
            options=options,
        )

    def add_text_field(
        self,
        form_id: str,
        label: str,
        is_required: bool = False,
        multiline: bool = False,
    ) -> Optional[FormField]:
        """Add a text field."""
        field_type = FieldType.TEXTAREA if multiline else FieldType.TEXT
        return self.add_field(form_id, field_type, label, is_required)

    def add_number_field(
        self,
        form_id: str,
        label: str,
        is_required: bool = False,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
    ) -> Optional[FormField]:
        """Add a number field."""
        field = self.add_field(form_id, FieldType.NUMBER, label, is_required)
        if field:
            field.min_value = min_value
            field.max_value = max_value
        return field

    def add_select_field(
        self,
        form_id: str,
        label: str,
        options: List[str],
        is_required: bool = False,
        allow_multiple: bool = False,
    ) -> Optional[FormField]:
        """Add a select field."""
        field_type = FieldType.MULTI_SELECT if allow_multiple else FieldType.SELECT
        option_list = [{"label": opt, "value": opt} for opt in options]
        return self.add_field(form_id, field_type, label, is_required, options=option_list)

    def add_radio_field(
        self,
        form_id: str,
        label: str,
        options: List[str],
        is_required: bool = False,
    ) -> Optional[FormField]:
        """Add a radio button field."""
        option_list = [{"label": opt, "value": opt} for opt in options]
        return self.add_field(form_id, FieldType.RADIO, label, is_required, options=option_list)

    def add_checkbox_field(
        self,
        form_id: str,
        label: str,
        options: List[str],
        is_required: bool = False,
    ) -> Optional[FormField]:
        """Add a checkbox field."""
        option_list = [{"label": opt, "value": opt} for opt in options]
        return self.add_field(form_id, FieldType.CHECKBOX, label, is_required, options=option_list)

    def add_rating_field(
        self,
        form_id: str,
        label: str,
        is_required: bool = False,
        max_rating: int = 5,
    ) -> Optional[FormField]:
        """Add a rating field."""
        field = self.add_field(form_id, FieldType.RATING, label, is_required)
        if field:
            field.max_value = max_rating
        return field

    def add_scale_field(
        self,
        form_id: str,
        label: str,
        min_value: int = 1,
        max_value: int = 10,
        is_required: bool = False,
    ) -> Optional[FormField]:
        """Add a scale field."""
        field = self.add_field(form_id, FieldType.SCALE, label, is_required)
        if field:
            field.min_value = min_value
            field.max_value = max_value
        return field

    def add_quiz_question(
        self,
        form_id: str,
        question: str,
        options: List[Dict[str, Any]],
        is_required: bool = True,
    ) -> Optional[FormField]:
        """Add a quiz question with scored options."""
        return self.add_field(
            form_id=form_id,
            field_type=FieldType.RADIO,
            label=question,
            is_required=is_required,
            options=options,
        )

    def get_field(self, form_id: str, field_id: str) -> Optional[FormField]:
        """Get a field."""
        return self._registry.get_field(form_id, field_id)

    def update_field(
        self,
        form_id: str,
        field_id: str,
        label: Optional[str] = None,
        is_required: Optional[bool] = None,
    ) -> Optional[FormField]:
        """Update a field."""
        return self._registry.update_field(form_id, field_id, label=label, is_required=is_required)

    def delete_field(self, form_id: str, field_id: str) -> bool:
        """Delete a field."""
        return self._registry.delete_field(form_id, field_id)

    def get_fields(self, form_id: str) -> List[FormField]:
        """Get all fields for a form."""
        return self._registry.get_fields(form_id)

    def reorder_fields(self, form_id: str, field_ids: List[str]) -> bool:
        """Reorder fields."""
        return self._registry.reorder_fields(form_id, field_ids)

    # Response methods
    def start_response(
        self,
        form_id: str,
        respondent_id: Optional[str] = None,
    ) -> Optional[FormResponse]:
        """Start a new response."""
        return self._registry.start_response(form_id, respondent_id)

    def save_response(
        self,
        response_id: str,
        field_values: Dict[str, Any],
    ) -> Optional[FormResponse]:
        """Save field values."""
        return self._registry.save_response(response_id, field_values)

    def submit_response(self, response_id: str) -> Optional[FormResponse]:
        """Submit a response."""
        return self._registry.submit_response(response_id)

    def quick_submit(
        self,
        form_id: str,
        field_values: Dict[str, Any],
        respondent_id: Optional[str] = None,
    ) -> Optional[FormResponse]:
        """Quick submit a response in one step."""
        response = self.start_response(form_id, respondent_id)
        if not response:
            return None

        self.save_response(response.id, field_values)
        return self.submit_response(response.id)

    def get_response(self, response_id: str) -> Optional[FormResponse]:
        """Get a response."""
        return self._registry.get_response(response_id)

    def get_responses(
        self,
        form_id: str,
        status: Optional[ResponseStatus] = None,
    ) -> List[FormResponse]:
        """Get responses for a form."""
        return self._registry.get_responses(form_id, status=status)

    def delete_response(self, response_id: str) -> bool:
        """Delete a response."""
        return self._registry.delete_response(response_id)

    def get_response_count(self, form_id: str) -> Dict[str, int]:
        """Get response counts."""
        return self._registry.get_response_count(form_id)

    # Template methods
    def create_template(
        self,
        name: str,
        created_by: str,
        form_type: FormType = FormType.SURVEY,
        fields_config: Optional[List[Dict[str, Any]]] = None,
    ) -> FormTemplate:
        """Create a template."""
        return self._registry.create_template(
            name=name,
            created_by=created_by,
            form_type=form_type,
            fields_config=fields_config,
        )

    def save_form_as_template(
        self,
        form_id: str,
        template_name: str,
        created_by: str,
    ) -> Optional[FormTemplate]:
        """Save a form as a template."""
        form = self._registry.get_form(form_id)
        if not form:
            return None

        fields = self._registry.get_fields(form_id)
        fields_config = [f.to_dict() for f in fields]

        return self._registry.create_template(
            name=template_name,
            created_by=created_by,
            form_type=form.form_type,
            description=form.description,
            fields_config=fields_config,
        )

    def get_template(self, template_id: str) -> Optional[FormTemplate]:
        """Get a template."""
        return self._registry.get_template(template_id)

    def list_templates(
        self,
        form_type: Optional[FormType] = None,
    ) -> List[FormTemplate]:
        """List templates."""
        return self._registry.list_templates(form_type=form_type)

    def create_form_from_template(
        self,
        template_id: str,
        title: str,
        creator_id: str,
    ) -> Optional[Form]:
        """Create a form from a template."""
        return self._registry.create_form_from_template(template_id, title, creator_id)

    def delete_template(self, template_id: str) -> bool:
        """Delete a template."""
        return self._registry.delete_template(template_id)

    # Analytics methods
    def record_view(self, form_id: str) -> None:
        """Record a form view."""
        self._registry.record_view(form_id)

    def get_analytics(self, form_id: str) -> Optional[FormAnalytics]:
        """Get form analytics."""
        return self._registry.get_analytics(form_id)

    def get_field_summary(self, form_id: str, field_id: str) -> Dict[str, Any]:
        """Get field summary."""
        return self._registry.get_field_summary(form_id, field_id)

    def get_form_summary(self, form_id: str) -> Dict[str, Any]:
        """Get complete form summary."""
        form = self._registry.get_form(form_id)
        if not form:
            return {}

        fields = self._registry.get_fields(form_id)
        analytics = self._registry.get_analytics(form_id)
        response_counts = self._registry.get_response_count(form_id)

        field_summaries = {}
        for field in fields:
            field_summaries[field.id] = self._registry.get_field_summary(form_id, field.id)

        return {
            "form": form.to_dict(),
            "analytics": analytics.to_dict() if analytics else None,
            "response_counts": response_counts,
            "field_summaries": field_summaries,
        }

    def get_stats(
        self,
        workspace_id: Optional[str] = None,
        creator_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get overall statistics."""
        return self._registry.get_stats(workspace_id, creator_id)

    def export_responses(
        self,
        form_id: str,
        format: str = "dict",
    ) -> List[Dict[str, Any]]:
        """Export form responses."""
        responses = self._registry.get_responses(form_id, status=ResponseStatus.VALIDATED)
        fields = self._registry.get_fields(form_id)

        field_map = {f.id: f for f in fields}
        exported = []

        for response in responses:
            row = {
                "response_id": response.id,
                "respondent_id": response.respondent_id,
                "submitted_at": response.submitted_at.isoformat() if response.submitted_at else None,
            }

            for field_id, field_response in response.field_responses.items():
                field = field_map.get(field_id)
                key = field.name if field else field_id
                row[key] = field_response.value

            if response.score is not None:
                row["score"] = response.score
                row["max_score"] = response.max_score

            exported.append(row)

        return exported


# Global instance management
_form_manager: Optional[FormManager] = None


def get_form_manager() -> FormManager:
    """Get the global form manager instance."""
    global _form_manager
    if _form_manager is None:
        _form_manager = FormManager()
    return _form_manager


def set_form_manager(manager: FormManager) -> None:
    """Set the global form manager instance."""
    global _form_manager
    _form_manager = manager


def reset_form_manager() -> None:
    """Reset the global form manager instance."""
    global _form_manager
    _form_manager = None
