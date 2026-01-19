"""
Tests for Templates & Blueprints Module

Tests cover:
- Template variable validation
- Template CRUD operations
- Template engine rendering
- Template registry management
- Blueprint creation and rendering
- Template builder API
- Template manager operations
"""

import pytest
from datetime import datetime, timedelta
from app.collaboration.templates import (
    TemplateManager,
    TemplateRegistry,
    TemplateEngine,
    Template,
    TemplateType,
    TemplateStatus,
    TemplateVariable,
    TemplateSection,
    TemplateVersion,
    VariableType,
    Blueprint,
    BlueprintComponent,
    BlueprintStatus,
    BlueprintRenderer,
    TemplateBuilder,
    TemplateInstance,
    RenderResult,
    RenderMode,
    get_template_manager,
    set_template_manager,
    reset_template_manager,
)


# ==================== TemplateVariable Tests ====================

class TestTemplateVariable:
    """Tests for TemplateVariable validation."""

    def test_string_variable_validation(self):
        """Test string variable validation."""
        var = TemplateVariable(
            name="title",
            var_type=VariableType.STRING,
            required=True
        )

        # Valid string
        is_valid, error = var.validate("Hello World")
        assert is_valid
        assert error is None

        # None when required
        is_valid, error = var.validate(None)
        assert not is_valid
        assert "required" in error

    def test_string_variable_length_validation(self):
        """Test string variable length constraints."""
        var = TemplateVariable(
            name="name",
            var_type=VariableType.STRING,
            min_length=3,
            max_length=10
        )

        # Too short
        is_valid, error = var.validate("ab")
        assert not is_valid
        assert "at least 3" in error

        # Too long
        is_valid, error = var.validate("verylongname")
        assert not is_valid
        assert "at most 10" in error

        # Valid
        is_valid, error = var.validate("valid")
        assert is_valid

    def test_string_variable_pattern_validation(self):
        """Test string variable pattern validation."""
        var = TemplateVariable(
            name="email",
            var_type=VariableType.STRING,
            validation_pattern=r'^[\w.-]+@[\w.-]+\.\w+$'
        )

        # Valid email
        is_valid, error = var.validate("test@example.com")
        assert is_valid

        # Invalid email
        is_valid, error = var.validate("not-an-email")
        assert not is_valid
        assert "pattern" in error

    def test_number_variable_validation(self):
        """Test number variable validation."""
        var = TemplateVariable(
            name="quantity",
            var_type=VariableType.NUMBER,
            min_value=1,
            max_value=100
        )

        # Valid number
        is_valid, error = var.validate(50)
        assert is_valid

        # Below min
        is_valid, error = var.validate(0)
        assert not is_valid
        assert "at least 1" in error

        # Above max
        is_valid, error = var.validate(150)
        assert not is_valid
        assert "at most 100" in error

    def test_number_variable_type_validation(self):
        """Test number variable type check."""
        var = TemplateVariable(
            name="count",
            var_type=VariableType.NUMBER
        )

        is_valid, error = var.validate("not a number")
        assert not is_valid
        assert "must be a number" in error

    def test_boolean_variable_validation(self):
        """Test boolean variable validation."""
        var = TemplateVariable(
            name="active",
            var_type=VariableType.BOOLEAN
        )

        is_valid, error = var.validate(True)
        assert is_valid

        is_valid, error = var.validate(False)
        assert is_valid

        is_valid, error = var.validate("true")
        assert not is_valid
        assert "must be a boolean" in error

    def test_choice_variable_validation(self):
        """Test choice variable validation."""
        var = TemplateVariable(
            name="color",
            var_type=VariableType.CHOICE,
            choices=["red", "green", "blue"]
        )

        is_valid, error = var.validate("red")
        assert is_valid

        is_valid, error = var.validate("yellow")
        assert not is_valid
        assert "must be one of" in error

    def test_list_variable_validation(self):
        """Test list variable validation."""
        var = TemplateVariable(
            name="items",
            var_type=VariableType.LIST
        )

        is_valid, error = var.validate(["a", "b", "c"])
        assert is_valid

        is_valid, error = var.validate("not a list")
        assert not is_valid
        assert "must be a list" in error

    def test_object_variable_validation(self):
        """Test object variable validation."""
        var = TemplateVariable(
            name="config",
            var_type=VariableType.OBJECT
        )

        is_valid, error = var.validate({"key": "value"})
        assert is_valid

        is_valid, error = var.validate("not an object")
        assert not is_valid
        assert "must be an object" in error

    def test_optional_variable_validation(self):
        """Test optional variable allows None."""
        var = TemplateVariable(
            name="optional",
            var_type=VariableType.STRING,
            required=False
        )

        is_valid, error = var.validate(None)
        assert is_valid
        assert error is None

    def test_variable_to_dict(self):
        """Test variable serialization."""
        var = TemplateVariable(
            name="title",
            var_type=VariableType.STRING,
            label="Title",
            description="Document title",
            default_value="Untitled",
            required=True
        )

        d = var.to_dict()
        assert d["name"] == "title"
        assert d["type"] == "string"
        assert d["label"] == "Title"
        assert d["required"] is True


# ==================== Template Tests ====================

class TestTemplate:
    """Tests for Template data class."""

    def test_template_creation(self):
        """Test template creation."""
        template = Template(
            id="tpl_1",
            name="Welcome Email",
            template_type=TemplateType.EMAIL,
            content="Hello {{ name }}!"
        )

        assert template.id == "tpl_1"
        assert template.name == "Welcome Email"
        assert template.template_type == TemplateType.EMAIL
        assert template.status == TemplateStatus.DRAFT

    def test_add_variable(self):
        """Test adding variables to template."""
        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT
        )

        var = TemplateVariable(name="title", var_type=VariableType.STRING)
        template.add_variable(var)

        assert len(template.variables) == 1
        assert template.get_variable("title") == var

    def test_add_variable_replaces_existing(self):
        """Test adding variable with same name replaces."""
        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT
        )

        var1 = TemplateVariable(name="title", var_type=VariableType.STRING, label="Old")
        var2 = TemplateVariable(name="title", var_type=VariableType.STRING, label="New")

        template.add_variable(var1)
        template.add_variable(var2)

        assert len(template.variables) == 1
        assert template.get_variable("title").label == "New"

    def test_remove_variable(self):
        """Test removing variable from template."""
        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT
        )

        var = TemplateVariable(name="title", var_type=VariableType.STRING)
        template.add_variable(var)

        result = template.remove_variable("title")
        assert result is True
        assert len(template.variables) == 0

        result = template.remove_variable("nonexistent")
        assert result is False

    def test_validate_values(self):
        """Test validating values against template variables."""
        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT
        )

        template.add_variable(TemplateVariable(
            name="name",
            var_type=VariableType.STRING,
            required=True
        ))
        template.add_variable(TemplateVariable(
            name="age",
            var_type=VariableType.NUMBER,
            min_value=0
        ))

        # Valid values
        is_valid, errors = template.validate_values({"name": "John", "age": 30})
        assert is_valid
        assert len(errors) == 0

        # Missing required
        is_valid, errors = template.validate_values({"age": 30})
        assert not is_valid
        assert len(errors) == 1

    def test_template_to_dict(self):
        """Test template serialization."""
        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            description="Test template",
            category="General",
            tags={"test", "sample"}
        )

        d = template.to_dict()
        assert d["id"] == "tpl_1"
        assert d["name"] == "Test"
        assert d["type"] == "document"
        assert d["category"] == "General"
        assert set(d["tags"]) == {"test", "sample"}


# ==================== TemplateEngine Tests ====================

class TestTemplateEngine:
    """Tests for TemplateEngine rendering."""

    def test_simple_variable_substitution(self):
        """Test simple variable substitution."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ name }}!"
        )
        template.add_variable(TemplateVariable(
            name="name",
            var_type=VariableType.STRING
        ))

        result = engine.render(template, {"name": "World"})
        assert result.success
        assert result.content == "Hello World!"
        assert "name" in result.used_variables

    def test_multiple_variables(self):
        """Test multiple variable substitutions."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Dear {{ recipient }}, From {{ sender }}"
        )

        result = engine.render(template, {"recipient": "Alice", "sender": "Bob"})
        assert result.success
        assert result.content == "Dear Alice, From Bob"

    def test_filter_upper(self):
        """Test upper filter."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ name | upper }}!"
        )

        result = engine.render(template, {"name": "world"})
        assert result.success
        assert result.content == "Hello WORLD!"

    def test_filter_lower(self):
        """Test lower filter."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ name | lower }}!"
        )

        result = engine.render(template, {"name": "WORLD"})
        assert result.success
        assert result.content == "Hello world!"

    def test_filter_title(self):
        """Test title filter."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ name | title }}!"
        )

        result = engine.render(template, {"name": "john doe"})
        assert result.success
        assert result.content == "Hello John Doe!"

    def test_filter_join(self):
        """Test join filter."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Items: {{ items | join }}"
        )

        result = engine.render(template, {"items": ["a", "b", "c"]})
        assert result.success
        assert result.content == "Items: a, b, c"

    def test_conditional_true(self):
        """Test conditional when true."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Start {% if show_greeting %}Hello!{% endif %} End"
        )

        result = engine.render(template, {"show_greeting": True})
        assert result.success
        assert result.content == "Start Hello! End"

    def test_conditional_false(self):
        """Test conditional when false."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Start {% if show_greeting %}Hello!{% endif %} End"
        )

        result = engine.render(template, {"show_greeting": False})
        assert result.success
        assert result.content == "Start  End"

    def test_loop_simple(self):
        """Test simple loop."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="{% for item in items %}{{ item }} {% endfor %}"
        )

        result = engine.render(template, {"items": ["A", "B", "C"]})
        assert result.success
        assert result.content == "A B C "

    def test_loop_with_objects(self):
        """Test loop with object properties."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="{% for user in users %}{{ user.name }}: {{ user.age }} {% endfor %}"
        )

        users = [
            {"name": "Alice", "age": 30},
            {"name": "Bob", "age": 25}
        ]
        result = engine.render(template, {"users": users})
        assert result.success
        assert "Alice: 30" in result.content
        assert "Bob: 25" in result.content

    def test_loop_empty_list(self):
        """Test loop with empty list."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Items: {% for item in items %}{{ item }}{% endfor %}"
        )

        result = engine.render(template, {"items": []})
        assert result.success
        assert result.content == "Items: "

    def test_default_values(self):
        """Test default values are used."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ name }}!"
        )
        template.add_variable(TemplateVariable(
            name="name",
            var_type=VariableType.STRING,
            default_value="Guest"
        ))

        result = engine.render(template, {})
        assert result.success
        assert result.content == "Hello Guest!"

    def test_validation_failure_production_mode(self):
        """Test validation failure in production mode."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ name }}!"
        )
        template.add_variable(TemplateVariable(
            name="name",
            var_type=VariableType.STRING,
            required=True
        ))

        result = engine.render(template, {}, RenderMode.PRODUCTION)
        assert not result.success
        assert len(result.errors) > 0

    def test_validation_failure_preview_mode(self):
        """Test validation failure in preview mode gives warnings."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ name }}!"
        )
        template.add_variable(TemplateVariable(
            name="name",
            var_type=VariableType.STRING,
            required=True
        ))

        result = engine.render(template, {}, RenderMode.PREVIEW)
        assert result.success  # Preview mode allows rendering
        assert len(result.warnings) > 0

    def test_unresolved_variable_warning(self):
        """Test unresolved variable gives warning."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ unknown }}!"
        )

        result = engine.render(template, {})
        assert result.success
        assert len(result.warnings) > 0
        assert any("unknown" in w for w in result.warnings)

    def test_custom_filter(self):
        """Test registering custom filter."""
        engine = TemplateEngine()
        engine.register_filter("reverse", lambda x: str(x)[::-1])

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="{{ word | reverse }}"
        )

        result = engine.render(template, {"word": "hello"})
        assert result.success
        assert result.content == "olleh"

    def test_preview_with_sample_values(self):
        """Test preview generates sample values."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ name }}, Count: {{ count }}"
        )
        template.add_variable(TemplateVariable(
            name="name",
            var_type=VariableType.STRING,
            label="Name"
        ))
        template.add_variable(TemplateVariable(
            name="count",
            var_type=VariableType.NUMBER
        ))

        result = engine.preview(template)
        assert result.success
        assert "[Name]" in result.content or "name" in result.content.lower()
        assert "0" in result.content

    def test_render_time_tracking(self):
        """Test render time is tracked."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ name }}!"
        )

        result = engine.render(template, {"name": "World"})
        assert result.render_time_ms >= 0


# ==================== TemplateRegistry Tests ====================

class TestTemplateRegistry:
    """Tests for TemplateRegistry."""

    def test_register_template(self):
        """Test registering a template."""
        registry = TemplateRegistry()

        template = registry.register_template(
            name="Welcome",
            template_type=TemplateType.EMAIL,
            content="Hello!"
        )

        assert template.id.startswith("tpl_")
        assert template.name == "Welcome"
        assert template.template_type == TemplateType.EMAIL

    def test_get_template(self):
        """Test getting a template by ID."""
        registry = TemplateRegistry()

        template = registry.register_template(
            name="Test",
            template_type=TemplateType.DOCUMENT
        )

        fetched = registry.get_template(template.id)
        assert fetched == template

        assert registry.get_template("nonexistent") is None

    def test_update_template(self):
        """Test updating a template."""
        registry = TemplateRegistry()

        template = registry.register_template(
            name="Test",
            template_type=TemplateType.DOCUMENT
        )

        template.name = "Updated"
        result = registry.update_template(template)

        assert result is True
        assert registry.get_template(template.id).name == "Updated"

    def test_delete_template(self):
        """Test deleting a template."""
        registry = TemplateRegistry()

        template = registry.register_template(
            name="Test",
            template_type=TemplateType.DOCUMENT
        )

        result = registry.delete_template(template.id)
        assert result is True
        assert registry.get_template(template.id) is None

        result = registry.delete_template("nonexistent")
        assert result is False

    def test_list_templates(self):
        """Test listing templates."""
        registry = TemplateRegistry()

        registry.register_template(
            name="Email 1",
            template_type=TemplateType.EMAIL,
            workspace_id="ws1"
        )
        registry.register_template(
            name="Doc 1",
            template_type=TemplateType.DOCUMENT,
            workspace_id="ws1"
        )
        registry.register_template(
            name="Email 2",
            template_type=TemplateType.EMAIL,
            workspace_id="ws2"
        )

        # All templates
        all_templates = registry.list_templates()
        assert len(all_templates) == 3

        # By workspace
        ws1_templates = registry.list_templates(workspace_id="ws1")
        assert len(ws1_templates) == 2

        # By type
        email_templates = registry.list_templates(template_type=TemplateType.EMAIL)
        assert len(email_templates) == 2

    def test_list_templates_by_category(self):
        """Test listing templates by category."""
        registry = TemplateRegistry()

        registry.register_template(
            name="Marketing Email",
            template_type=TemplateType.EMAIL,
            category="marketing"
        )
        registry.register_template(
            name="Support Email",
            template_type=TemplateType.EMAIL,
            category="support"
        )

        marketing = registry.list_templates(category="marketing")
        assert len(marketing) == 1
        assert marketing[0].name == "Marketing Email"

    def test_list_templates_by_status(self):
        """Test listing templates by status."""
        registry = TemplateRegistry()

        t1 = registry.register_template(
            name="Draft",
            template_type=TemplateType.DOCUMENT
        )
        t2 = registry.register_template(
            name="Published",
            template_type=TemplateType.DOCUMENT
        )
        t2.status = TemplateStatus.PUBLISHED

        drafts = registry.list_templates(status=TemplateStatus.DRAFT)
        assert len(drafts) == 1

    def test_list_templates_by_tags(self):
        """Test listing templates by tags."""
        registry = TemplateRegistry()

        registry.register_template(
            name="Template 1",
            template_type=TemplateType.DOCUMENT,
            tags={"important", "review"}
        )
        registry.register_template(
            name="Template 2",
            template_type=TemplateType.DOCUMENT,
            tags={"important"}
        )

        important = registry.list_templates(tags={"important"})
        assert len(important) == 2

        review = registry.list_templates(tags={"review"})
        assert len(review) == 1

    def test_search_templates(self):
        """Test searching templates."""
        registry = TemplateRegistry()

        registry.register_template(
            name="Welcome Email",
            template_type=TemplateType.EMAIL,
            description="Sent to new users"
        )
        registry.register_template(
            name="Goodbye Email",
            template_type=TemplateType.EMAIL,
            description="Sent when user leaves"
        )
        registry.register_template(
            name="User Report",
            template_type=TemplateType.REPORT,
            tags={"user", "analytics"}
        )

        # Search by name
        results = registry.search_templates("welcome")
        assert len(results) == 1

        # Search by description
        results = registry.search_templates("new users")
        assert len(results) == 1

        # Search by tag
        results = registry.search_templates("analytics")
        assert len(results) == 1

    def test_clone_template(self):
        """Test cloning a template."""
        registry = TemplateRegistry()

        original = registry.register_template(
            name="Original",
            template_type=TemplateType.EMAIL,
            content="Hello {{ name }}!",
            category="general"
        )
        original.add_variable(TemplateVariable(
            name="name",
            var_type=VariableType.STRING
        ))

        cloned = registry.clone_template(original.id, "Cloned")

        assert cloned is not None
        assert cloned.id != original.id
        assert cloned.name == "Cloned"
        assert cloned.content == original.content
        assert cloned.parent_id == original.id
        assert cloned.status == TemplateStatus.DRAFT
        assert len(cloned.variables) == 1

    def test_publish_template(self):
        """Test publishing a template."""
        registry = TemplateRegistry()

        template = registry.register_template(
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello!"
        )

        result = registry.publish_template(template.id)

        assert result is True
        assert template.status == TemplateStatus.PUBLISHED
        assert len(template.versions) == 1
        assert template.versions[0].is_published

    def test_archive_template(self):
        """Test archiving a template."""
        registry = TemplateRegistry()

        template = registry.register_template(
            name="Test",
            template_type=TemplateType.DOCUMENT
        )

        result = registry.archive_template(template.id)

        assert result is True
        assert template.status == TemplateStatus.ARCHIVED

    def test_get_categories(self):
        """Test getting all categories."""
        registry = TemplateRegistry()

        registry.register_template(
            name="T1",
            template_type=TemplateType.DOCUMENT,
            category="marketing"
        )
        registry.register_template(
            name="T2",
            template_type=TemplateType.DOCUMENT,
            category="support"
        )

        categories = registry.get_categories()
        assert "marketing" in categories
        assert "support" in categories

    def test_get_templates_by_category(self):
        """Test getting templates by category."""
        registry = TemplateRegistry()

        registry.register_template(
            name="T1",
            template_type=TemplateType.DOCUMENT,
            category="marketing"
        )
        registry.register_template(
            name="T2",
            template_type=TemplateType.DOCUMENT,
            category="marketing"
        )

        templates = registry.get_templates_by_category("marketing")
        assert len(templates) == 2


# ==================== Blueprint Tests ====================

class TestBlueprint:
    """Tests for Blueprint functionality."""

    def test_blueprint_creation(self):
        """Test blueprint creation."""
        blueprint = Blueprint(
            id="bp_1",
            name="Project Setup",
            description="Standard project setup blueprint"
        )

        assert blueprint.id == "bp_1"
        assert blueprint.name == "Project Setup"
        assert blueprint.status == BlueprintStatus.DRAFT

    def test_add_component(self):
        """Test adding component to blueprint."""
        blueprint = Blueprint(id="bp_1", name="Test")

        component = BlueprintComponent(
            id="comp_1",
            name="Header",
            template_id="tpl_1"
        )

        blueprint.add_component(component)

        assert len(blueprint.components) == 1
        assert blueprint.get_component("comp_1") == component

    def test_remove_component(self):
        """Test removing component from blueprint."""
        blueprint = Blueprint(id="bp_1", name="Test")

        component = BlueprintComponent(
            id="comp_1",
            name="Header",
            template_id="tpl_1"
        )
        blueprint.add_component(component)

        result = blueprint.remove_component("comp_1")
        assert result is True
        assert len(blueprint.components) == 0

        result = blueprint.remove_component("nonexistent")
        assert result is False

    def test_blueprint_to_dict(self):
        """Test blueprint serialization."""
        blueprint = Blueprint(
            id="bp_1",
            name="Test",
            description="Test blueprint",
            category="project",
            tags={"setup", "standard"}
        )

        d = blueprint.to_dict()
        assert d["id"] == "bp_1"
        assert d["name"] == "Test"
        assert d["category"] == "project"


# ==================== BlueprintRenderer Tests ====================

class TestBlueprintRenderer:
    """Tests for BlueprintRenderer."""

    def test_render_simple_blueprint(self):
        """Test rendering a simple blueprint."""
        registry = TemplateRegistry()
        renderer = BlueprintRenderer(registry)

        # Create templates
        header = registry.register_template(
            name="Header",
            template_type=TemplateType.COMPONENT,
            content="# {{ title }}"
        )
        body = registry.register_template(
            name="Body",
            template_type=TemplateType.COMPONENT,
            content="Content: {{ content }}"
        )

        # Create blueprint
        blueprint = registry.register_blueprint(name="Page")
        blueprint.add_component(BlueprintComponent(
            id="comp_1",
            name="Header",
            template_id=header.id,
            order=0,
            variable_mappings={"page_title": "title"}
        ))
        blueprint.add_component(BlueprintComponent(
            id="comp_2",
            name="Body",
            template_id=body.id,
            order=1,
            variable_mappings={"page_content": "content"}
        ))

        result = renderer.render(blueprint, {
            "page_title": "Welcome",
            "page_content": "Hello World"
        })

        assert result.success
        assert "# Welcome" in result.content
        assert "Content: Hello World" in result.content

    def test_render_blueprint_with_conditional(self):
        """Test rendering blueprint with conditional component."""
        registry = TemplateRegistry()
        renderer = BlueprintRenderer(registry)

        # Create templates
        main = registry.register_template(
            name="Main",
            template_type=TemplateType.COMPONENT,
            content="Main content"
        )
        optional = registry.register_template(
            name="Optional",
            template_type=TemplateType.COMPONENT,
            content="Optional content"
        )

        # Create blueprint
        blueprint = registry.register_blueprint(name="Page")
        blueprint.add_component(BlueprintComponent(
            id="comp_1",
            name="Main",
            template_id=main.id,
            order=0
        ))
        blueprint.add_component(BlueprintComponent(
            id="comp_2",
            name="Optional",
            template_id=optional.id,
            order=1,
            conditional="show_optional"
        ))

        # Without optional
        result = renderer.render(blueprint, {"show_optional": False})
        assert result.success
        assert "Main content" in result.content
        assert "Optional content" not in result.content

        # With optional
        result = renderer.render(blueprint, {"show_optional": True})
        assert result.success
        assert "Optional content" in result.content

    def test_render_blueprint_missing_template(self):
        """Test rendering blueprint with missing template."""
        registry = TemplateRegistry()
        renderer = BlueprintRenderer(registry)

        blueprint = registry.register_blueprint(name="Page")
        blueprint.add_component(BlueprintComponent(
            id="comp_1",
            name="Missing",
            template_id="nonexistent"
        ))

        result = renderer.render(blueprint, {})
        assert result.success  # Continues but with warnings
        assert len(result.warnings) > 0


# ==================== TemplateBuilder Tests ====================

class TestTemplateBuilder:
    """Tests for TemplateBuilder."""

    def test_basic_builder(self):
        """Test basic template building."""
        template = (
            TemplateBuilder("Welcome", TemplateType.EMAIL)
            .with_content("Hello {{ name }}!")
            .with_description("Welcome email template")
            .build()
        )

        assert template.name == "Welcome"
        assert template.template_type == TemplateType.EMAIL
        assert template.content == "Hello {{ name }}!"
        assert template.description == "Welcome email template"

    def test_builder_with_variables(self):
        """Test builder with variable additions."""
        template = (
            TemplateBuilder("Form", TemplateType.FORM)
            .with_content("Name: {{ name }}, Age: {{ age }}")
            .add_string_variable("name", "Full Name", required=True)
            .add_number_variable("age", "Age", min_value=0, max_value=150)
            .build()
        )

        assert len(template.variables) == 2

        name_var = template.get_variable("name")
        assert name_var.required is True

        age_var = template.get_variable("age")
        assert age_var.min_value == 0
        assert age_var.max_value == 150

    def test_builder_with_boolean_variable(self):
        """Test builder with boolean variable."""
        template = (
            TemplateBuilder("Test", TemplateType.DOCUMENT)
            .add_boolean_variable("active", "Active", default=True)
            .build()
        )

        var = template.get_variable("active")
        assert var.var_type == VariableType.BOOLEAN
        assert var.default_value is True

    def test_builder_with_choice_variable(self):
        """Test builder with choice variable."""
        template = (
            TemplateBuilder("Test", TemplateType.DOCUMENT)
            .add_choice_variable(
                "priority",
                ["low", "medium", "high"],
                label="Priority",
                default="medium"
            )
            .build()
        )

        var = template.get_variable("priority")
        assert var.var_type == VariableType.CHOICE
        assert var.choices == ["low", "medium", "high"]

    def test_builder_with_list_variable(self):
        """Test builder with list variable."""
        template = (
            TemplateBuilder("Test", TemplateType.DOCUMENT)
            .add_list_variable("items", "Items", required=True)
            .build()
        )

        var = template.get_variable("items")
        assert var.var_type == VariableType.LIST
        assert var.required is True

    def test_builder_with_category_and_tags(self):
        """Test builder with category and tags."""
        template = (
            TemplateBuilder("Test", TemplateType.EMAIL)
            .with_category("marketing")
            .with_tags("promotion", "newsletter")
            .build()
        )

        assert template.category == "marketing"
        assert "promotion" in template.tags
        assert "newsletter" in template.tags

    def test_builder_with_sections(self):
        """Test builder with sections."""
        template = (
            TemplateBuilder("Report", TemplateType.REPORT)
            .add_section("intro", "Introduction", "This is the intro", order=0)
            .add_section("body", "Body", "This is the body", order=1)
            .build()
        )

        assert len(template.sections) == 2
        assert template.sections[0].name == "Introduction"

    def test_builder_with_metadata(self):
        """Test builder with metadata."""
        template = (
            TemplateBuilder("Test", TemplateType.DOCUMENT)
            .with_metadata("author", "John")
            .with_metadata("version", "1.0")
            .build()
        )

        assert template.metadata["author"] == "John"
        assert template.metadata["version"] == "1.0"


# ==================== TemplateRegistry Blueprint Tests ====================

class TestTemplateRegistryBlueprint:
    """Tests for blueprint functionality in TemplateRegistry."""

    def test_register_blueprint(self):
        """Test registering a blueprint."""
        registry = TemplateRegistry()

        blueprint = registry.register_blueprint(
            name="Project Setup",
            workspace_id="ws1"
        )

        assert blueprint.id.startswith("bp_")
        assert blueprint.name == "Project Setup"
        assert blueprint.workspace_id == "ws1"

    def test_get_blueprint(self):
        """Test getting a blueprint."""
        registry = TemplateRegistry()

        blueprint = registry.register_blueprint(name="Test")

        fetched = registry.get_blueprint(blueprint.id)
        assert fetched == blueprint

        assert registry.get_blueprint("nonexistent") is None

    def test_update_blueprint(self):
        """Test updating a blueprint."""
        registry = TemplateRegistry()

        blueprint = registry.register_blueprint(name="Test")
        blueprint.name = "Updated"

        result = registry.update_blueprint(blueprint)
        assert result is True

    def test_delete_blueprint(self):
        """Test deleting a blueprint."""
        registry = TemplateRegistry()

        blueprint = registry.register_blueprint(name="Test")

        result = registry.delete_blueprint(blueprint.id)
        assert result is True
        assert registry.get_blueprint(blueprint.id) is None

    def test_list_blueprints(self):
        """Test listing blueprints."""
        registry = TemplateRegistry()

        registry.register_blueprint(name="BP1", workspace_id="ws1")
        registry.register_blueprint(name="BP2", workspace_id="ws1")
        registry.register_blueprint(name="BP3", workspace_id="ws2")

        all_blueprints = registry.list_blueprints()
        assert len(all_blueprints) == 3

        ws1_blueprints = registry.list_blueprints(workspace_id="ws1")
        assert len(ws1_blueprints) == 2

    def test_list_blueprints_by_status(self):
        """Test listing blueprints by status."""
        registry = TemplateRegistry()

        bp1 = registry.register_blueprint(name="Draft")
        bp2 = registry.register_blueprint(name="Active")
        bp2.status = BlueprintStatus.ACTIVE

        drafts = registry.list_blueprints(status=BlueprintStatus.DRAFT)
        assert len(drafts) == 1


# ==================== Template Instance Tests ====================

class TestTemplateInstance:
    """Tests for template instances."""

    def test_create_instance(self):
        """Test creating a template instance."""
        registry = TemplateRegistry()

        template = registry.register_template(
            name="Welcome",
            template_type=TemplateType.EMAIL,
            content="Hello {{ name }}!"
        )
        template.add_variable(TemplateVariable(
            name="name",
            var_type=VariableType.STRING
        ))

        instance = registry.create_instance(
            template_id=template.id,
            values={"name": "World"},
            workspace_id="ws1",
            created_by="user1"
        )

        assert instance is not None
        assert instance.template_id == template.id
        assert instance.values["name"] == "World"
        assert instance.rendered_content == "Hello World!"

    def test_get_instance(self):
        """Test getting an instance."""
        registry = TemplateRegistry()

        template = registry.register_template(
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Test"
        )

        instance = registry.create_instance(
            template_id=template.id,
            values={}
        )

        fetched = registry.get_instance(instance.id)
        assert fetched == instance

    def test_list_instances(self):
        """Test listing instances."""
        registry = TemplateRegistry()

        t1 = registry.register_template(
            name="T1",
            template_type=TemplateType.DOCUMENT,
            content="Test 1"
        )
        t2 = registry.register_template(
            name="T2",
            template_type=TemplateType.DOCUMENT,
            content="Test 2"
        )

        registry.create_instance(t1.id, {}, workspace_id="ws1")
        registry.create_instance(t1.id, {}, workspace_id="ws1")
        registry.create_instance(t2.id, {}, workspace_id="ws2")

        all_instances = registry.list_instances()
        assert len(all_instances) == 3

        t1_instances = registry.list_instances(template_id=t1.id)
        assert len(t1_instances) == 2

        ws1_instances = registry.list_instances(workspace_id="ws1")
        assert len(ws1_instances) == 2


# ==================== TemplateManager Tests ====================

class TestTemplateManager:
    """Tests for TemplateManager."""

    def test_create_template(self):
        """Test creating template via manager."""
        manager = TemplateManager()

        template = manager.create_template(
            name="Welcome",
            template_type=TemplateType.EMAIL,
            content="Hello!"
        )

        assert template.name == "Welcome"
        assert manager.get_template(template.id) == template

    def test_render_template(self):
        """Test rendering template via manager."""
        manager = TemplateManager()

        template = manager.create_template(
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ name }}!"
        )

        result = manager.render_template(template.id, {"name": "World"})
        assert result.success
        assert result.content == "Hello World!"

    def test_render_nonexistent_template(self):
        """Test rendering nonexistent template."""
        manager = TemplateManager()

        result = manager.render_template("nonexistent", {})
        assert not result.success
        assert "not found" in result.errors[0].lower()

    def test_preview_template(self):
        """Test previewing template."""
        manager = TemplateManager()

        template = manager.create_template(
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ name }}!"
        )
        template.add_variable(TemplateVariable(
            name="name",
            var_type=VariableType.STRING,
            label="Name"
        ))

        result = manager.preview_template(template.id)
        assert result.success

    def test_create_blueprint(self):
        """Test creating blueprint via manager."""
        manager = TemplateManager()

        blueprint = manager.create_blueprint(
            name="Project",
            workspace_id="ws1"
        )

        assert blueprint.name == "Project"

    def test_render_blueprint(self):
        """Test rendering blueprint via manager."""
        manager = TemplateManager()

        template = manager.create_template(
            name="Component",
            template_type=TemplateType.COMPONENT,
            content="Hello {{ name }}!"
        )

        blueprint = manager.create_blueprint(name="Page")
        blueprint.add_component(BlueprintComponent(
            id="comp_1",
            name="Greeting",
            template_id=template.id,
            variable_mappings={"user_name": "name"}
        ))

        result = manager.render_blueprint(blueprint.id, {"user_name": "World"})
        assert result.success
        assert "Hello World!" in result.content

    def test_create_from_template(self):
        """Test creating instance from template."""
        manager = TemplateManager()

        template = manager.create_template(
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ name }}!"
        )

        instance = manager.create_from_template(
            template_id=template.id,
            values={"name": "World"},
            created_by="user1"
        )

        assert instance is not None
        assert instance.rendered_content == "Hello World!"

    def test_list_templates(self):
        """Test listing templates via manager."""
        manager = TemplateManager()

        manager.create_template(
            name="T1",
            template_type=TemplateType.EMAIL
        )
        manager.create_template(
            name="T2",
            template_type=TemplateType.DOCUMENT
        )

        templates = manager.list_templates()
        assert len(templates) == 2

    def test_list_blueprints(self):
        """Test listing blueprints via manager."""
        manager = TemplateManager()

        manager.create_blueprint(name="BP1")
        manager.create_blueprint(name="BP2")

        blueprints = manager.list_blueprints()
        assert len(blueprints) == 2

    def test_search(self):
        """Test searching templates via manager."""
        manager = TemplateManager()

        manager.create_template(
            name="Welcome Email",
            template_type=TemplateType.EMAIL
        )
        manager.create_template(
            name="Goodbye Email",
            template_type=TemplateType.EMAIL
        )

        results = manager.search("welcome")
        assert len(results) == 1

    def test_get_stats(self):
        """Test getting stats via manager."""
        manager = TemplateManager()

        manager.create_template(
            name="Email",
            template_type=TemplateType.EMAIL
        )
        manager.create_template(
            name="Doc",
            template_type=TemplateType.DOCUMENT
        )
        manager.create_blueprint(name="BP")

        stats = manager.get_stats()
        assert stats["total_templates"] == 2
        assert stats["total_blueprints"] == 1
        assert stats["templates_by_type"]["email"] == 1
        assert stats["templates_by_type"]["document"] == 1


# ==================== Global Functions Tests ====================

class TestGlobalFunctions:
    """Tests for global template manager functions."""

    def test_get_set_template_manager(self):
        """Test get/set template manager."""
        reset_template_manager()

        assert get_template_manager() is None

        manager = TemplateManager()
        set_template_manager(manager)

        assert get_template_manager() == manager

    def test_reset_template_manager(self):
        """Test resetting template manager."""
        manager = TemplateManager()
        set_template_manager(manager)

        reset_template_manager()

        assert get_template_manager() is None


# ==================== Edge Cases Tests ====================

class TestEdgeCases:
    """Tests for edge cases."""

    def test_empty_content_template(self):
        """Test template with empty content."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Empty",
            template_type=TemplateType.DOCUMENT,
            content=""
        )

        result = engine.render(template, {})
        assert result.success
        assert result.content == ""

    def test_nested_loops_not_supported(self):
        """Test that basic nested structures work."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="{% for item in items %}[{{ item }}]{% endfor %}"
        )

        result = engine.render(template, {"items": ["a", "b"]})
        assert result.success
        assert "[a][b]" in result.content

    def test_special_characters_in_variable_value(self):
        """Test special characters in variable values."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Value: {{ value }}"
        )

        result = engine.render(template, {"value": "<script>alert('xss')</script>"})
        assert result.success
        assert "<script>" in result.content  # No escaping by default

    def test_whitespace_in_variable_syntax(self):
        """Test whitespace handling in variable syntax."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="{{  name  }}"
        )

        result = engine.render(template, {"name": "Test"})
        assert result.success
        assert result.content == "Test"

    def test_template_with_many_variables(self):
        """Test template with many variables."""
        engine = TemplateEngine()

        content = " ".join([f"{{{{ var{i} }}}}" for i in range(20)])
        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content=content
        )

        values = {f"var{i}": f"value{i}" for i in range(20)}
        result = engine.render(template, values)

        assert result.success
        assert "value0" in result.content
        assert "value19" in result.content

    def test_unicode_in_template(self):
        """Test unicode content in template."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="Hello {{ name }} 🎉 你好"
        )

        result = engine.render(template, {"name": "世界"})
        assert result.success
        assert "世界" in result.content
        assert "🎉" in result.content

    def test_consecutive_variables(self):
        """Test consecutive variables without separator."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="{{ first }}{{ last }}"
        )

        result = engine.render(template, {"first": "John", "last": "Doe"})
        assert result.success
        assert result.content == "JohnDoe"

    def test_variable_in_loop(self):
        """Test variable inside loop block."""
        engine = TemplateEngine()

        template = Template(
            id="tpl_1",
            name="Test",
            template_type=TemplateType.DOCUMENT,
            content="{% for item in items %}{{ item }}-{{ suffix }}{% endfor %}"
        )

        result = engine.render(template, {"items": ["a", "b"], "suffix": "!"})
        assert result.success
        assert "a-!" in result.content
        assert "b-!" in result.content
