"""
Tests for the Forms & Surveys module.
"""

import pytest
from datetime import datetime, timedelta
from typing import Dict, Any

from app.collaboration.forms import (
    FormManager,
    FormRegistry,
    Form,
    FormStatus,
    FormType,
    FormField,
    FieldType,
    FieldOption,
    FieldValidation,
    FieldCondition,
    ValidationRule,
    ConditionOperator,
    FormResponse,
    FieldResponse,
    ResponseStatus,
    FormTemplate,
    FormAnalytics,
    get_form_manager,
    set_form_manager,
    reset_form_manager,
)


# ============================================================
# Enum Tests
# ============================================================

class TestFormEnums:
    """Test form enumeration types."""

    def test_form_status_values(self) -> None:
        """Test FormStatus enum values."""
        assert FormStatus.DRAFT.value == "draft"
        assert FormStatus.PUBLISHED.value == "published"
        assert FormStatus.CLOSED.value == "closed"
        assert FormStatus.ARCHIVED.value == "archived"

    def test_form_type_values(self) -> None:
        """Test FormType enum values."""
        assert FormType.SURVEY.value == "survey"
        assert FormType.POLL.value == "poll"
        assert FormType.QUIZ.value == "quiz"
        assert FormType.FEEDBACK.value == "feedback"
        assert FormType.REGISTRATION.value == "registration"
        assert FormType.APPLICATION.value == "application"
        assert FormType.CUSTOM.value == "custom"

    def test_field_type_values(self) -> None:
        """Test FieldType enum values."""
        assert FieldType.TEXT.value == "text"
        assert FieldType.TEXTAREA.value == "textarea"
        assert FieldType.NUMBER.value == "number"
        assert FieldType.EMAIL.value == "email"
        assert FieldType.SELECT.value == "select"
        assert FieldType.RADIO.value == "radio"
        assert FieldType.CHECKBOX.value == "checkbox"
        assert FieldType.RATING.value == "rating"
        assert FieldType.SCALE.value == "scale"

    def test_validation_rule_values(self) -> None:
        """Test ValidationRule enum values."""
        assert ValidationRule.REQUIRED.value == "required"
        assert ValidationRule.MIN_LENGTH.value == "min_length"
        assert ValidationRule.MAX_LENGTH.value == "max_length"
        assert ValidationRule.MIN_VALUE.value == "min_value"
        assert ValidationRule.MAX_VALUE.value == "max_value"
        assert ValidationRule.PATTERN.value == "pattern"
        assert ValidationRule.EMAIL.value == "email"

    def test_condition_operator_values(self) -> None:
        """Test ConditionOperator enum values."""
        assert ConditionOperator.EQUALS.value == "equals"
        assert ConditionOperator.NOT_EQUALS.value == "not_equals"
        assert ConditionOperator.CONTAINS.value == "contains"
        assert ConditionOperator.GREATER_THAN.value == "greater_than"
        assert ConditionOperator.IS_EMPTY.value == "is_empty"

    def test_response_status_values(self) -> None:
        """Test ResponseStatus enum values."""
        assert ResponseStatus.IN_PROGRESS.value == "in_progress"
        assert ResponseStatus.SUBMITTED.value == "submitted"
        assert ResponseStatus.VALIDATED.value == "validated"
        assert ResponseStatus.REJECTED.value == "rejected"


# ============================================================
# FieldOption Tests
# ============================================================

class TestFieldOption:
    """Test FieldOption dataclass."""

    def test_create_option(self) -> None:
        """Test creating a field option."""
        option = FieldOption(
            id="opt1",
            label="Option 1",
            value="value1",
            position=0,
        )
        assert option.id == "opt1"
        assert option.label == "Option 1"
        assert option.value == "value1"
        assert option.score == 0

    def test_option_with_score(self) -> None:
        """Test option with score for quiz."""
        option = FieldOption(
            id="opt1",
            label="Correct Answer",
            value="correct",
            score=10,
        )
        assert option.score == 10

    def test_option_to_dict(self) -> None:
        """Test option to_dict method."""
        option = FieldOption(
            id="opt1",
            label="Option 1",
            value="value1",
            position=1,
            is_other=True,
            score=5,
        )
        data = option.to_dict()
        assert data["id"] == "opt1"
        assert data["label"] == "Option 1"
        assert data["is_other"] is True
        assert data["score"] == 5


# ============================================================
# FieldValidation Tests
# ============================================================

class TestFieldValidation:
    """Test FieldValidation dataclass."""

    def test_required_validation(self) -> None:
        """Test required validation rule."""
        validation = FieldValidation(rule=ValidationRule.REQUIRED)

        assert validation.validate("hello") is True
        assert validation.validate("") is False
        assert validation.validate(None) is False
        assert validation.validate([]) is False
        assert validation.validate(["item"]) is True

    def test_min_length_validation(self) -> None:
        """Test min length validation."""
        validation = FieldValidation(rule=ValidationRule.MIN_LENGTH, value=5)

        assert validation.validate("hello") is True
        assert validation.validate("hi") is False
        assert validation.validate("") is True  # Empty is valid if not required
        assert validation.validate(None) is True

    def test_max_length_validation(self) -> None:
        """Test max length validation."""
        validation = FieldValidation(rule=ValidationRule.MAX_LENGTH, value=5)

        assert validation.validate("hi") is True
        assert validation.validate("hello") is True
        assert validation.validate("hello!") is False

    def test_min_value_validation(self) -> None:
        """Test min value validation."""
        validation = FieldValidation(rule=ValidationRule.MIN_VALUE, value=10)

        assert validation.validate(15) is True
        assert validation.validate(10) is True
        assert validation.validate(5) is False
        assert validation.validate("invalid") is False

    def test_max_value_validation(self) -> None:
        """Test max value validation."""
        validation = FieldValidation(rule=ValidationRule.MAX_VALUE, value=100)

        assert validation.validate(50) is True
        assert validation.validate(100) is True
        assert validation.validate(150) is False

    def test_pattern_validation(self) -> None:
        """Test pattern validation."""
        validation = FieldValidation(rule=ValidationRule.PATTERN, value=r"^\d{3}-\d{4}$")

        assert validation.validate("123-4567") is True
        assert validation.validate("abc-defg") is False

    def test_email_validation(self) -> None:
        """Test email validation."""
        validation = FieldValidation(rule=ValidationRule.EMAIL)

        assert validation.validate("test@example.com") is True
        assert validation.validate("invalid-email") is False
        assert validation.validate("user@domain") is False

    def test_url_validation(self) -> None:
        """Test URL validation."""
        validation = FieldValidation(rule=ValidationRule.URL)

        assert validation.validate("https://example.com") is True
        assert validation.validate("http://test.org/path") is True
        assert validation.validate("not-a-url") is False

    def test_phone_validation(self) -> None:
        """Test phone validation."""
        validation = FieldValidation(rule=ValidationRule.PHONE)

        assert validation.validate("+1 (555) 123-4567") is True
        assert validation.validate("555-1234") is True
        assert validation.validate("abc-defg") is False

    def test_validation_to_dict(self) -> None:
        """Test validation to_dict method."""
        validation = FieldValidation(
            rule=ValidationRule.MIN_LENGTH,
            value=5,
            message="Must be at least 5 characters",
        )
        data = validation.to_dict()
        assert data["rule"] == "min_length"
        assert data["value"] == 5
        assert data["message"] == "Must be at least 5 characters"


# ============================================================
# FieldCondition Tests
# ============================================================

class TestFieldCondition:
    """Test FieldCondition dataclass."""

    def test_equals_condition(self) -> None:
        """Test equals condition."""
        condition = FieldCondition(
            source_field_id="field1",
            operator=ConditionOperator.EQUALS,
            value="yes",
        )

        assert condition.evaluate({"field1": "yes"}) is True
        assert condition.evaluate({"field1": "no"}) is False

    def test_not_equals_condition(self) -> None:
        """Test not equals condition."""
        condition = FieldCondition(
            source_field_id="field1",
            operator=ConditionOperator.NOT_EQUALS,
            value="no",
        )

        assert condition.evaluate({"field1": "yes"}) is True
        assert condition.evaluate({"field1": "no"}) is False

    def test_contains_string_condition(self) -> None:
        """Test contains condition for strings."""
        condition = FieldCondition(
            source_field_id="field1",
            operator=ConditionOperator.CONTAINS,
            value="test",
        )

        assert condition.evaluate({"field1": "this is a test"}) is True
        assert condition.evaluate({"field1": "no match"}) is False

    def test_contains_list_condition(self) -> None:
        """Test contains condition for lists."""
        condition = FieldCondition(
            source_field_id="field1",
            operator=ConditionOperator.CONTAINS,
            value="option1",
        )

        assert condition.evaluate({"field1": ["option1", "option2"]}) is True
        assert condition.evaluate({"field1": ["option3"]}) is False

    def test_greater_than_condition(self) -> None:
        """Test greater than condition."""
        condition = FieldCondition(
            source_field_id="field1",
            operator=ConditionOperator.GREATER_THAN,
            value=10,
        )

        assert condition.evaluate({"field1": 15}) is True
        assert condition.evaluate({"field1": 5}) is False
        assert condition.evaluate({"field1": "invalid"}) is False

    def test_less_than_condition(self) -> None:
        """Test less than condition."""
        condition = FieldCondition(
            source_field_id="field1",
            operator=ConditionOperator.LESS_THAN,
            value=10,
        )

        assert condition.evaluate({"field1": 5}) is True
        assert condition.evaluate({"field1": 15}) is False

    def test_is_empty_condition(self) -> None:
        """Test is empty condition."""
        condition = FieldCondition(
            source_field_id="field1",
            operator=ConditionOperator.IS_EMPTY,
            value=None,
        )

        assert condition.evaluate({"field1": None}) is True
        assert condition.evaluate({"field1": ""}) is True
        assert condition.evaluate({"field1": []}) is True
        assert condition.evaluate({"field1": "value"}) is False

    def test_is_not_empty_condition(self) -> None:
        """Test is not empty condition."""
        condition = FieldCondition(
            source_field_id="field1",
            operator=ConditionOperator.IS_NOT_EMPTY,
            value=None,
        )

        assert condition.evaluate({"field1": "value"}) is True
        assert condition.evaluate({"field1": None}) is False
        assert condition.evaluate({"field1": ""}) is False

    def test_condition_to_dict(self) -> None:
        """Test condition to_dict method."""
        condition = FieldCondition(
            source_field_id="field1",
            operator=ConditionOperator.EQUALS,
            value="test",
        )
        data = condition.to_dict()
        assert data["source_field_id"] == "field1"
        assert data["operator"] == "equals"
        assert data["value"] == "test"


# ============================================================
# FormField Tests
# ============================================================

class TestFormField:
    """Test FormField dataclass."""

    def test_create_field(self) -> None:
        """Test creating a form field."""
        field = FormField(
            id="field1",
            form_id="form1",
            field_type=FieldType.TEXT,
            label="Name",
            name="name",
        )
        assert field.id == "field1"
        assert field.field_type == FieldType.TEXT
        assert field.label == "Name"
        assert field.is_required is False

    def test_required_field_adds_validation(self) -> None:
        """Test that required field adds validation."""
        field = FormField(
            id="field1",
            form_id="form1",
            field_type=FieldType.TEXT,
            label="Name",
            name="name",
            is_required=True,
        )
        assert any(v.rule == ValidationRule.REQUIRED for v in field.validations)

    def test_field_validate_value(self) -> None:
        """Test field value validation."""
        field = FormField(
            id="field1",
            form_id="form1",
            field_type=FieldType.TEXT,
            label="Name",
            name="name",
            is_required=True,
        )

        errors = field.validate_value("John")
        assert len(errors) == 0

        errors = field.validate_value("")
        assert len(errors) > 0

    def test_field_should_show_no_conditions(self) -> None:
        """Test field visibility with no conditions."""
        field = FormField(
            id="field1",
            form_id="form1",
            field_type=FieldType.TEXT,
            label="Name",
            name="name",
        )
        assert field.should_show({}) is True

    def test_field_should_show_with_conditions(self) -> None:
        """Test field visibility with conditions."""
        field = FormField(
            id="field1",
            form_id="form1",
            field_type=FieldType.TEXT,
            label="Name",
            name="name",
            conditions=[
                FieldCondition(
                    source_field_id="field0",
                    operator=ConditionOperator.EQUALS,
                    value="yes",
                )
            ],
        )
        assert field.should_show({"field0": "yes"}) is True
        assert field.should_show({"field0": "no"}) is False

    def test_field_to_dict(self) -> None:
        """Test field to_dict method."""
        field = FormField(
            id="field1",
            form_id="form1",
            field_type=FieldType.SELECT,
            label="Color",
            name="color",
            is_required=True,
            options=[
                FieldOption(id="o1", label="Red", value="red", position=0),
            ],
        )
        data = field.to_dict()
        assert data["id"] == "field1"
        assert data["field_type"] == "select"
        assert data["is_required"] is True
        assert len(data["options"]) == 1


# ============================================================
# Form Tests
# ============================================================

class TestForm:
    """Test Form dataclass."""

    def test_create_form(self) -> None:
        """Test creating a form."""
        form = Form(
            id="form1",
            title="Survey",
            creator_id="user1",
        )
        assert form.id == "form1"
        assert form.title == "Survey"
        assert form.status == FormStatus.DRAFT
        assert form.form_type == FormType.SURVEY

    def test_form_is_open_draft(self) -> None:
        """Test is_open for draft form."""
        form = Form(id="form1", title="Survey", creator_id="user1")
        assert form.is_open is False

    def test_form_is_open_published(self) -> None:
        """Test is_open for published form."""
        form = Form(id="form1", title="Survey", creator_id="user1")
        form.publish()
        assert form.is_open is True

    def test_form_is_open_with_date_range(self) -> None:
        """Test is_open with start/end dates."""
        form = Form(
            id="form1",
            title="Survey",
            creator_id="user1",
            starts_at=datetime.utcnow() - timedelta(days=1),
            ends_at=datetime.utcnow() + timedelta(days=1),
        )
        form.publish()
        assert form.is_open is True

    def test_form_is_open_not_started(self) -> None:
        """Test is_open when not yet started."""
        form = Form(
            id="form1",
            title="Survey",
            creator_id="user1",
            starts_at=datetime.utcnow() + timedelta(days=1),
        )
        form.publish()
        assert form.is_open is False

    def test_form_is_open_ended(self) -> None:
        """Test is_open when ended."""
        form = Form(
            id="form1",
            title="Survey",
            creator_id="user1",
            ends_at=datetime.utcnow() - timedelta(days=1),
        )
        form.publish()
        assert form.is_open is False

    def test_form_publish(self) -> None:
        """Test publishing a form."""
        form = Form(id="form1", title="Survey", creator_id="user1")
        form.publish()
        assert form.status == FormStatus.PUBLISHED
        assert form.published_at is not None

    def test_form_close(self) -> None:
        """Test closing a form."""
        form = Form(id="form1", title="Survey", creator_id="user1")
        form.publish()
        form.close()
        assert form.status == FormStatus.CLOSED
        assert form.closed_at is not None

    def test_form_archive(self) -> None:
        """Test archiving a form."""
        form = Form(id="form1", title="Survey", creator_id="user1")
        form.archive()
        assert form.status == FormStatus.ARCHIVED

    def test_form_reopen(self) -> None:
        """Test reopening a form."""
        form = Form(id="form1", title="Survey", creator_id="user1")
        form.publish()
        form.close()
        form.reopen()
        assert form.status == FormStatus.PUBLISHED
        assert form.closed_at is None

    def test_form_to_dict(self) -> None:
        """Test form to_dict method."""
        form = Form(
            id="form1",
            title="Survey",
            creator_id="user1",
            description="A test survey",
            tags={"tag1", "tag2"},
        )
        data = form.to_dict()
        assert data["id"] == "form1"
        assert data["title"] == "Survey"
        assert data["description"] == "A test survey"
        assert set(data["tags"]) == {"tag1", "tag2"}


# ============================================================
# FormResponse Tests
# ============================================================

class TestFormResponse:
    """Test FormResponse dataclass."""

    def test_create_response(self) -> None:
        """Test creating a form response."""
        response = FormResponse(
            id="resp1",
            form_id="form1",
            respondent_id="user1",
        )
        assert response.id == "resp1"
        assert response.status == ResponseStatus.IN_PROGRESS
        assert response.is_complete is False

    def test_response_set_field_value(self) -> None:
        """Test setting field values."""
        response = FormResponse(id="resp1", form_id="form1")
        response.set_field_value("field1", "value1")
        assert response.get_field_value("field1") == "value1"

    def test_response_update_field_value(self) -> None:
        """Test updating field values."""
        response = FormResponse(id="resp1", form_id="form1")
        response.set_field_value("field1", "value1")
        response.set_field_value("field1", "value2")
        assert response.get_field_value("field1") == "value2"

    def test_response_get_nonexistent_field(self) -> None:
        """Test getting nonexistent field value."""
        response = FormResponse(id="resp1", form_id="form1")
        assert response.get_field_value("field1") is None

    def test_response_submit(self) -> None:
        """Test submitting response."""
        response = FormResponse(id="resp1", form_id="form1")
        response.submit()
        assert response.status == ResponseStatus.SUBMITTED
        assert response.submitted_at is not None
        assert response.completion_time_seconds is not None

    def test_response_is_complete(self) -> None:
        """Test is_complete property."""
        response = FormResponse(id="resp1", form_id="form1")
        assert response.is_complete is False

        response.status = ResponseStatus.SUBMITTED
        assert response.is_complete is True

        response.status = ResponseStatus.VALIDATED
        assert response.is_complete is True

    def test_response_score_percentage(self) -> None:
        """Test score percentage calculation."""
        response = FormResponse(id="resp1", form_id="form1")
        assert response.score_percentage is None

        response.score = 8
        response.max_score = 10
        assert response.score_percentage == 80.0

    def test_response_to_dict(self) -> None:
        """Test response to_dict method."""
        response = FormResponse(
            id="resp1",
            form_id="form1",
            respondent_id="user1",
        )
        response.set_field_value("field1", "value1")
        data = response.to_dict()
        assert data["id"] == "resp1"
        assert data["form_id"] == "form1"
        assert "field1" in data["field_responses"]


# ============================================================
# FormTemplate Tests
# ============================================================

class TestFormTemplate:
    """Test FormTemplate dataclass."""

    def test_create_template(self) -> None:
        """Test creating a template."""
        template = FormTemplate(
            id="tmpl1",
            name="Basic Survey",
            description="A basic survey template",
            form_type=FormType.SURVEY,
            created_by="user1",
        )
        assert template.id == "tmpl1"
        assert template.name == "Basic Survey"
        assert template.is_system is False

    def test_template_with_fields_config(self) -> None:
        """Test template with field configuration."""
        template = FormTemplate(
            id="tmpl1",
            name="Feedback Form",
            created_by="user1",
            fields_config=[
                {"field_type": "rating", "label": "Rating", "is_required": True},
                {"field_type": "textarea", "label": "Comments"},
            ],
        )
        assert len(template.fields_config) == 2

    def test_template_to_dict(self) -> None:
        """Test template to_dict method."""
        template = FormTemplate(
            id="tmpl1",
            name="Survey",
            created_by="user1",
            category="feedback",
        )
        data = template.to_dict()
        assert data["id"] == "tmpl1"
        assert data["name"] == "Survey"
        assert data["category"] == "feedback"


# ============================================================
# FormAnalytics Tests
# ============================================================

class TestFormAnalytics:
    """Test FormAnalytics dataclass."""

    def test_create_analytics(self) -> None:
        """Test creating analytics."""
        analytics = FormAnalytics(form_id="form1")
        assert analytics.total_views == 0
        assert analytics.total_completions == 0

    def test_calculate_completion_rate(self) -> None:
        """Test completion rate calculation."""
        analytics = FormAnalytics(form_id="form1")
        analytics.total_starts = 100
        analytics.total_completions = 75
        analytics.calculate_completion_rate()
        assert analytics.completion_rate == 75.0

    def test_calculate_completion_rate_no_starts(self) -> None:
        """Test completion rate with no starts."""
        analytics = FormAnalytics(form_id="form1")
        analytics.calculate_completion_rate()
        assert analytics.completion_rate == 0

    def test_analytics_to_dict(self) -> None:
        """Test analytics to_dict method."""
        analytics = FormAnalytics(
            form_id="form1",
            total_views=100,
            total_starts=50,
            total_completions=40,
        )
        data = analytics.to_dict()
        assert data["form_id"] == "form1"
        assert data["total_views"] == 100


# ============================================================
# FormRegistry Tests
# ============================================================

class TestFormRegistry:
    """Test FormRegistry class."""

    @pytest.fixture
    def registry(self) -> FormRegistry:
        """Create a registry for testing."""
        return FormRegistry()

    # Form CRUD tests
    def test_create_form(self, registry: FormRegistry) -> None:
        """Test creating a form."""
        form = registry.create_form(
            title="Test Survey",
            creator_id="user1",
            form_type=FormType.SURVEY,
        )
        assert form.id is not None
        assert form.title == "Test Survey"
        assert form.status == FormStatus.DRAFT

    def test_get_form(self, registry: FormRegistry) -> None:
        """Test getting a form."""
        form = registry.create_form(title="Survey", creator_id="user1")
        retrieved = registry.get_form(form.id)
        assert retrieved is not None
        assert retrieved.id == form.id

    def test_get_nonexistent_form(self, registry: FormRegistry) -> None:
        """Test getting nonexistent form."""
        form = registry.get_form("nonexistent")
        assert form is None

    def test_update_form(self, registry: FormRegistry) -> None:
        """Test updating a form."""
        form = registry.create_form(title="Survey", creator_id="user1")
        updated = registry.update_form(
            form.id,
            title="Updated Survey",
            description="New description",
        )
        assert updated is not None
        assert updated.title == "Updated Survey"
        assert updated.description == "New description"

    def test_delete_form(self, registry: FormRegistry) -> None:
        """Test deleting a form."""
        form = registry.create_form(title="Survey", creator_id="user1")
        result = registry.delete_form(form.id)
        assert result is True
        assert registry.get_form(form.id) is None

    def test_delete_nonexistent_form(self, registry: FormRegistry) -> None:
        """Test deleting nonexistent form."""
        result = registry.delete_form("nonexistent")
        assert result is False

    def test_publish_form(self, registry: FormRegistry) -> None:
        """Test publishing a form."""
        form = registry.create_form(title="Survey", creator_id="user1")
        published = registry.publish_form(form.id)
        assert published is not None
        assert published.status == FormStatus.PUBLISHED

    def test_close_form(self, registry: FormRegistry) -> None:
        """Test closing a form."""
        form = registry.create_form(title="Survey", creator_id="user1")
        registry.publish_form(form.id)
        closed = registry.close_form(form.id)
        assert closed is not None
        assert closed.status == FormStatus.CLOSED

    def test_list_forms(self, registry: FormRegistry) -> None:
        """Test listing forms."""
        registry.create_form(title="Survey 1", creator_id="user1", form_type=FormType.SURVEY)
        registry.create_form(title="Poll 1", creator_id="user1", form_type=FormType.POLL)
        registry.create_form(title="Survey 2", creator_id="user2", form_type=FormType.SURVEY)

        all_forms = registry.list_forms()
        assert len(all_forms) == 3

        user1_forms = registry.list_forms(creator_id="user1")
        assert len(user1_forms) == 2

        surveys = registry.list_forms(form_type=FormType.SURVEY)
        assert len(surveys) == 2

    def test_list_forms_with_tags(self, registry: FormRegistry) -> None:
        """Test listing forms by tags."""
        registry.create_form(title="Survey 1", creator_id="user1", tags={"hr", "annual"})
        registry.create_form(title="Survey 2", creator_id="user1", tags={"it"})

        hr_forms = registry.list_forms(tags={"hr"})
        assert len(hr_forms) == 1

    # Field CRUD tests
    def test_add_field(self, registry: FormRegistry) -> None:
        """Test adding a field."""
        form = registry.create_form(title="Survey", creator_id="user1")
        field = registry.add_field(
            form_id=form.id,
            field_type=FieldType.TEXT,
            label="Name",
        )
        assert field is not None
        assert field.label == "Name"
        assert field.name == "name"

    def test_add_field_with_options(self, registry: FormRegistry) -> None:
        """Test adding a field with options."""
        form = registry.create_form(title="Survey", creator_id="user1")
        field = registry.add_field(
            form_id=form.id,
            field_type=FieldType.SELECT,
            label="Color",
            options=[
                {"label": "Red", "value": "red"},
                {"label": "Blue", "value": "blue"},
            ],
        )
        assert field is not None
        assert len(field.options) == 2

    def test_add_field_with_validations(self, registry: FormRegistry) -> None:
        """Test adding a field with validations."""
        form = registry.create_form(title="Survey", creator_id="user1")
        field = registry.add_field(
            form_id=form.id,
            field_type=FieldType.TEXT,
            label="Email",
            validations=[
                {"rule": "required"},
                {"rule": "email", "message": "Invalid email"},
            ],
        )
        assert field is not None
        assert len(field.validations) == 2

    def test_get_field(self, registry: FormRegistry) -> None:
        """Test getting a field."""
        form = registry.create_form(title="Survey", creator_id="user1")
        field = registry.add_field(form.id, FieldType.TEXT, "Name")
        retrieved = registry.get_field(form.id, field.id)
        assert retrieved is not None
        assert retrieved.id == field.id

    def test_update_field(self, registry: FormRegistry) -> None:
        """Test updating a field."""
        form = registry.create_form(title="Survey", creator_id="user1")
        field = registry.add_field(form.id, FieldType.TEXT, "Name")
        updated = registry.update_field(
            form.id,
            field.id,
            label="Full Name",
            is_required=True,
        )
        assert updated is not None
        assert updated.label == "Full Name"
        assert updated.is_required is True

    def test_delete_field(self, registry: FormRegistry) -> None:
        """Test deleting a field."""
        form = registry.create_form(title="Survey", creator_id="user1")
        field = registry.add_field(form.id, FieldType.TEXT, "Name")
        result = registry.delete_field(form.id, field.id)
        assert result is True
        assert registry.get_field(form.id, field.id) is None

    def test_get_fields(self, registry: FormRegistry) -> None:
        """Test getting all fields."""
        form = registry.create_form(title="Survey", creator_id="user1")
        registry.add_field(form.id, FieldType.TEXT, "Name")
        registry.add_field(form.id, FieldType.EMAIL, "Email")
        fields = registry.get_fields(form.id)
        assert len(fields) == 2

    def test_reorder_fields(self, registry: FormRegistry) -> None:
        """Test reordering fields."""
        form = registry.create_form(title="Survey", creator_id="user1")
        f1 = registry.add_field(form.id, FieldType.TEXT, "Field 1")
        f2 = registry.add_field(form.id, FieldType.TEXT, "Field 2")
        f3 = registry.add_field(form.id, FieldType.TEXT, "Field 3")

        registry.reorder_fields(form.id, [f3.id, f1.id, f2.id])
        fields = registry.get_fields(form.id)
        assert fields[0].id == f3.id
        assert fields[1].id == f1.id

    # Response tests
    def test_start_response(self, registry: FormRegistry) -> None:
        """Test starting a response."""
        form = registry.create_form(title="Survey", creator_id="user1")
        registry.publish_form(form.id)

        response = registry.start_response(form.id, respondent_id="user2")
        assert response is not None
        assert response.form_id == form.id

    def test_start_response_draft_form(self, registry: FormRegistry) -> None:
        """Test starting response on draft form."""
        form = registry.create_form(title="Survey", creator_id="user1")
        response = registry.start_response(form.id, respondent_id="user2")
        assert response is None

    def test_start_response_limit_reached(self, registry: FormRegistry) -> None:
        """Test response limit."""
        form = registry.create_form(title="Survey", creator_id="user1")
        registry.update_form(form.id, response_limit=1)
        registry.publish_form(form.id)

        r1 = registry.start_response(form.id, respondent_id="user2")
        registry.submit_response(r1.id)

        r2 = registry.start_response(form.id, respondent_id="user3")
        assert r2 is None

    def test_no_multiple_responses(self, registry: FormRegistry) -> None:
        """Test preventing multiple responses."""
        form = registry.create_form(title="Survey", creator_id="user1")
        registry.publish_form(form.id)

        r1 = registry.start_response(form.id, respondent_id="user2")
        registry.submit_response(r1.id)

        r2 = registry.start_response(form.id, respondent_id="user2")
        assert r2 is None

    def test_allow_multiple_responses(self, registry: FormRegistry) -> None:
        """Test allowing multiple responses."""
        form = registry.create_form(
            title="Survey",
            creator_id="user1",
            allow_multiple_responses=True,
        )
        registry.publish_form(form.id)

        r1 = registry.start_response(form.id, respondent_id="user2")
        registry.submit_response(r1.id)

        r2 = registry.start_response(form.id, respondent_id="user2")
        assert r2 is not None

    def test_save_response(self, registry: FormRegistry) -> None:
        """Test saving response values."""
        form = registry.create_form(title="Survey", creator_id="user1")
        registry.add_field(form.id, FieldType.TEXT, "Name")
        registry.publish_form(form.id)

        response = registry.start_response(form.id)
        saved = registry.save_response(response.id, {"field1": "John"})
        assert saved is not None

    def test_submit_response(self, registry: FormRegistry) -> None:
        """Test submitting a response."""
        form = registry.create_form(title="Survey", creator_id="user1")
        f = registry.add_field(form.id, FieldType.TEXT, "Name", is_required=True)
        registry.publish_form(form.id)

        response = registry.start_response(form.id)
        registry.save_response(response.id, {f.id: "John"})
        submitted = registry.submit_response(response.id)

        assert submitted is not None
        assert submitted.status == ResponseStatus.VALIDATED

    def test_submit_response_validation_failure(self, registry: FormRegistry) -> None:
        """Test submit with validation failure."""
        form = registry.create_form(title="Survey", creator_id="user1")
        registry.add_field(form.id, FieldType.TEXT, "Name", is_required=True)
        registry.publish_form(form.id)

        response = registry.start_response(form.id)
        submitted = registry.submit_response(response.id)

        assert submitted is not None
        assert submitted.status == ResponseStatus.REJECTED

    def test_get_responses(self, registry: FormRegistry) -> None:
        """Test getting responses."""
        form = registry.create_form(title="Survey", creator_id="user1")
        registry.publish_form(form.id)

        registry.start_response(form.id, respondent_id="user1")
        registry.start_response(form.id, respondent_id="user2")

        responses = registry.get_responses(form.id)
        assert len(responses) == 2

    def test_delete_response(self, registry: FormRegistry) -> None:
        """Test deleting a response."""
        form = registry.create_form(title="Survey", creator_id="user1")
        registry.publish_form(form.id)

        response = registry.start_response(form.id)
        result = registry.delete_response(response.id)
        assert result is True

    def test_response_count(self, registry: FormRegistry) -> None:
        """Test response count."""
        form = registry.create_form(title="Survey", creator_id="user1")
        registry.publish_form(form.id)

        r1 = registry.start_response(form.id)
        registry.submit_response(r1.id)
        r2 = registry.start_response(form.id)

        counts = registry.get_response_count(form.id)
        assert counts["total"] == 2
        assert counts["validated"] == 1
        assert counts["in_progress"] == 1

    # Quiz scoring tests
    def test_quiz_scoring(self, registry: FormRegistry) -> None:
        """Test quiz score calculation."""
        form = registry.create_form(
            title="Quiz",
            creator_id="user1",
            form_type=FormType.QUIZ,
        )
        field = registry.add_field(
            form.id,
            FieldType.RADIO,
            "Question 1",
            options=[
                {"label": "Wrong", "value": "a", "score": 0},
                {"label": "Correct", "value": "b", "score": 10},
            ],
        )
        registry.publish_form(form.id)

        response = registry.start_response(form.id)
        registry.save_response(response.id, {field.id: "b"})
        submitted = registry.submit_response(response.id)

        assert submitted.score == 10
        assert submitted.max_score == 10

    # Template tests
    def test_create_template(self, registry: FormRegistry) -> None:
        """Test creating a template."""
        template = registry.create_template(
            name="Basic Survey",
            created_by="user1",
            form_type=FormType.SURVEY,
        )
        assert template.id is not None
        assert template.name == "Basic Survey"

    def test_get_template(self, registry: FormRegistry) -> None:
        """Test getting a template."""
        template = registry.create_template(name="Survey", created_by="user1")
        retrieved = registry.get_template(template.id)
        assert retrieved is not None
        assert retrieved.id == template.id

    def test_list_templates(self, registry: FormRegistry) -> None:
        """Test listing templates."""
        registry.create_template(name="Survey", created_by="user1", form_type=FormType.SURVEY)
        registry.create_template(name="Feedback", created_by="user1", form_type=FormType.FEEDBACK)

        all_templates = registry.list_templates()
        assert len(all_templates) == 2

        surveys = registry.list_templates(form_type=FormType.SURVEY)
        assert len(surveys) == 1

    def test_create_form_from_template(self, registry: FormRegistry) -> None:
        """Test creating form from template."""
        template = registry.create_template(
            name="Survey Template",
            created_by="user1",
            form_type=FormType.SURVEY,
            fields_config=[
                {"field_type": "text", "label": "Name", "is_required": True},
                {"field_type": "email", "label": "Email"},
            ],
        )

        form = registry.create_form_from_template(
            template.id,
            title="My Survey",
            creator_id="user2",
        )

        assert form is not None
        assert form.title == "My Survey"
        fields = registry.get_fields(form.id)
        assert len(fields) == 2

    def test_delete_template(self, registry: FormRegistry) -> None:
        """Test deleting a template."""
        template = registry.create_template(name="Survey", created_by="user1")
        result = registry.delete_template(template.id)
        assert result is True
        assert registry.get_template(template.id) is None

    # Analytics tests
    def test_get_analytics(self, registry: FormRegistry) -> None:
        """Test getting analytics."""
        form = registry.create_form(title="Survey", creator_id="user1")
        analytics = registry.get_analytics(form.id)
        assert analytics is not None
        assert analytics.form_id == form.id

    def test_record_view(self, registry: FormRegistry) -> None:
        """Test recording views."""
        form = registry.create_form(title="Survey", creator_id="user1")
        registry.record_view(form.id)
        registry.record_view(form.id)

        analytics = registry.get_analytics(form.id)
        assert analytics.total_views == 2

    def test_field_summary_select(self, registry: FormRegistry) -> None:
        """Test field summary for select field."""
        form = registry.create_form(title="Survey", creator_id="user1")
        field = registry.add_field(
            form.id,
            FieldType.SELECT,
            "Color",
            options=[
                {"label": "Red", "value": "red"},
                {"label": "Blue", "value": "blue"},
            ],
        )
        registry.publish_form(form.id)

        # Add responses
        r1 = registry.start_response(form.id)
        registry.save_response(r1.id, {field.id: "red"})
        registry.submit_response(r1.id)

        r2 = registry.start_response(form.id)
        registry.save_response(r2.id, {field.id: "red"})
        registry.submit_response(r2.id)

        r3 = registry.start_response(form.id)
        registry.save_response(r3.id, {field.id: "blue"})
        registry.submit_response(r3.id)

        summary = registry.get_field_summary(form.id, field.id)
        assert summary["total_responses"] == 3
        assert summary["option_counts"]["red"] == 2
        assert summary["option_counts"]["blue"] == 1

    def test_field_summary_number(self, registry: FormRegistry) -> None:
        """Test field summary for number field."""
        form = registry.create_form(title="Survey", creator_id="user1")
        field = registry.add_field(form.id, FieldType.NUMBER, "Age")
        registry.publish_form(form.id)

        for age in [20, 30, 40]:
            r = registry.start_response(form.id)
            registry.save_response(r.id, {field.id: age})
            registry.submit_response(r.id)

        summary = registry.get_field_summary(form.id, field.id)
        assert summary["min"] == 20
        assert summary["max"] == 40
        assert summary["avg"] == 30

    def test_get_stats(self, registry: FormRegistry) -> None:
        """Test getting stats."""
        registry.create_form(title="Survey 1", creator_id="user1")
        form2 = registry.create_form(title="Survey 2", creator_id="user1")
        registry.publish_form(form2.id)

        stats = registry.get_stats()
        assert stats["total_forms"] == 2
        assert stats["forms_by_status"]["draft"] == 1
        assert stats["forms_by_status"]["published"] == 1


# ============================================================
# FormManager Tests
# ============================================================

class TestFormManager:
    """Test FormManager class."""

    @pytest.fixture
    def manager(self) -> FormManager:
        """Create a manager for testing."""
        return FormManager()

    def test_create_form(self, manager: FormManager) -> None:
        """Test creating a form."""
        form = manager.create_form(
            title="Survey",
            creator_id="user1",
            description="A test survey",
        )
        assert form.id is not None
        assert form.title == "Survey"

    def test_create_poll(self, manager: FormManager) -> None:
        """Test creating a poll."""
        form = manager.create_poll(
            title="Favorite Color",
            creator_id="user1",
            question="What is your favorite color?",
            options=["Red", "Blue", "Green"],
        )

        assert form.form_type == FormType.POLL
        fields = manager.get_fields(form.id)
        assert len(fields) == 1
        assert fields[0].field_type == FieldType.RADIO

    def test_create_poll_multiple(self, manager: FormManager) -> None:
        """Test creating a multiple choice poll."""
        form = manager.create_poll(
            title="Favorite Colors",
            creator_id="user1",
            question="Select your favorite colors",
            options=["Red", "Blue", "Green"],
            allow_multiple=True,
        )

        fields = manager.get_fields(form.id)
        assert fields[0].field_type == FieldType.MULTI_SELECT

    def test_create_quiz(self, manager: FormManager) -> None:
        """Test creating a quiz."""
        form = manager.create_quiz(
            title="Math Quiz",
            creator_id="user1",
            description="Basic math quiz",
        )
        assert form.form_type == FormType.QUIZ

    def test_create_feedback_form(self, manager: FormManager) -> None:
        """Test creating a feedback form."""
        form = manager.create_feedback_form(
            title="Product Feedback",
            creator_id="user1",
        )

        assert form.form_type == FormType.FEEDBACK
        assert form.allow_anonymous is True
        fields = manager.get_fields(form.id)
        assert len(fields) == 2  # Rating and textarea

    def test_add_text_field(self, manager: FormManager) -> None:
        """Test adding a text field."""
        form = manager.create_form(title="Survey", creator_id="user1")
        field = manager.add_text_field(form.id, "Name", is_required=True)
        assert field.field_type == FieldType.TEXT

    def test_add_textarea_field(self, manager: FormManager) -> None:
        """Test adding a textarea field."""
        form = manager.create_form(title="Survey", creator_id="user1")
        field = manager.add_text_field(form.id, "Comments", multiline=True)
        assert field.field_type == FieldType.TEXTAREA

    def test_add_number_field(self, manager: FormManager) -> None:
        """Test adding a number field."""
        form = manager.create_form(title="Survey", creator_id="user1")
        field = manager.add_number_field(
            form.id,
            "Age",
            is_required=True,
            min_value=0,
            max_value=120,
        )
        assert field.field_type == FieldType.NUMBER
        assert field.min_value == 0
        assert field.max_value == 120

    def test_add_select_field(self, manager: FormManager) -> None:
        """Test adding a select field."""
        form = manager.create_form(title="Survey", creator_id="user1")
        field = manager.add_select_field(
            form.id,
            "Country",
            ["USA", "Canada", "UK"],
        )
        assert field.field_type == FieldType.SELECT
        assert len(field.options) == 3

    def test_add_radio_field(self, manager: FormManager) -> None:
        """Test adding a radio field."""
        form = manager.create_form(title="Survey", creator_id="user1")
        field = manager.add_radio_field(
            form.id,
            "Gender",
            ["Male", "Female", "Other"],
        )
        assert field.field_type == FieldType.RADIO

    def test_add_checkbox_field(self, manager: FormManager) -> None:
        """Test adding a checkbox field."""
        form = manager.create_form(title="Survey", creator_id="user1")
        field = manager.add_checkbox_field(
            form.id,
            "Interests",
            ["Sports", "Music", "Art"],
        )
        assert field.field_type == FieldType.CHECKBOX

    def test_add_rating_field(self, manager: FormManager) -> None:
        """Test adding a rating field."""
        form = manager.create_form(title="Survey", creator_id="user1")
        field = manager.add_rating_field(form.id, "Overall Rating", max_rating=10)
        assert field.field_type == FieldType.RATING
        assert field.max_value == 10

    def test_add_scale_field(self, manager: FormManager) -> None:
        """Test adding a scale field."""
        form = manager.create_form(title="Survey", creator_id="user1")
        field = manager.add_scale_field(
            form.id,
            "Satisfaction",
            min_value=1,
            max_value=5,
        )
        assert field.field_type == FieldType.SCALE
        assert field.min_value == 1
        assert field.max_value == 5

    def test_add_quiz_question(self, manager: FormManager) -> None:
        """Test adding a quiz question."""
        form = manager.create_quiz(title="Quiz", creator_id="user1")
        field = manager.add_quiz_question(
            form.id,
            "2 + 2 = ?",
            options=[
                {"label": "3", "value": "3", "score": 0},
                {"label": "4", "value": "4", "score": 10},
                {"label": "5", "value": "5", "score": 0},
            ],
        )
        assert len(field.options) == 3
        assert field.options[1].score == 10

    def test_quick_submit(self, manager: FormManager) -> None:
        """Test quick submit."""
        form = manager.create_form(title="Survey", creator_id="user1")
        f1 = manager.add_text_field(form.id, "Name", is_required=True)
        manager.publish_form(form.id)

        response = manager.quick_submit(
            form.id,
            {f1.id: "John"},
            respondent_id="user2",
        )

        assert response is not None
        assert response.status == ResponseStatus.VALIDATED

    def test_save_form_as_template(self, manager: FormManager) -> None:
        """Test saving form as template."""
        form = manager.create_form(title="Survey", creator_id="user1")
        manager.add_text_field(form.id, "Name")
        manager.add_rating_field(form.id, "Rating")

        template = manager.save_form_as_template(
            form.id,
            "My Template",
            "user1",
        )

        assert template is not None
        assert template.name == "My Template"
        assert len(template.fields_config) == 2

    def test_create_form_from_template(self, manager: FormManager) -> None:
        """Test creating form from template."""
        template = manager.create_template(
            name="Basic Survey",
            created_by="user1",
            fields_config=[
                {"field_type": "text", "label": "Name"},
            ],
        )

        form = manager.create_form_from_template(
            template.id,
            "New Survey",
            "user2",
        )

        assert form is not None
        assert form.title == "New Survey"

    def test_get_form_summary(self, manager: FormManager) -> None:
        """Test getting form summary."""
        form = manager.create_form(title="Survey", creator_id="user1")
        manager.add_text_field(form.id, "Name")

        summary = manager.get_form_summary(form.id)
        assert "form" in summary
        assert "analytics" in summary
        assert "field_summaries" in summary

    def test_export_responses(self, manager: FormManager) -> None:
        """Test exporting responses."""
        form = manager.create_form(title="Survey", creator_id="user1")
        f1 = manager.add_text_field(form.id, "Name")
        manager.publish_form(form.id)

        manager.quick_submit(form.id, {f1.id: "John"}, "user2")
        manager.quick_submit(form.id, {f1.id: "Jane"}, "user3")

        exported = manager.export_responses(form.id)
        assert len(exported) == 2
        assert "response_id" in exported[0]

    def test_get_stats(self, manager: FormManager) -> None:
        """Test getting stats."""
        manager.create_form(title="Survey 1", creator_id="user1", workspace_id="ws1")
        manager.create_form(title="Survey 2", creator_id="user1", workspace_id="ws1")

        stats = manager.get_stats(workspace_id="ws1")
        assert stats["total_forms"] == 2


# ============================================================
# Global Instance Tests
# ============================================================

class TestGlobalInstance:
    """Test global instance management."""

    def setup_method(self) -> None:
        """Reset before each test."""
        reset_form_manager()

    def teardown_method(self) -> None:
        """Reset after each test."""
        reset_form_manager()

    def test_get_form_manager(self) -> None:
        """Test getting global manager."""
        manager = get_form_manager()
        assert manager is not None
        assert isinstance(manager, FormManager)

    def test_get_same_instance(self) -> None:
        """Test getting same instance."""
        manager1 = get_form_manager()
        manager2 = get_form_manager()
        assert manager1 is manager2

    def test_set_form_manager(self) -> None:
        """Test setting custom manager."""
        custom = FormManager()
        set_form_manager(custom)
        assert get_form_manager() is custom

    def test_reset_form_manager(self) -> None:
        """Test resetting manager."""
        manager1 = get_form_manager()
        reset_form_manager()
        manager2 = get_form_manager()
        assert manager1 is not manager2
