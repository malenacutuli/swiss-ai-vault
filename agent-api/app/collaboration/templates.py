"""
Templates & Blueprints Module

Implements template functionality with:
- Template registry and management
- Blueprint system for complex templates
- Template variables and placeholders
- Template versioning and inheritance
- Template rendering engine
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union
from abc import ABC, abstractmethod
import re
import time
import copy
import json


# ==================== Enums ====================

class TemplateType(Enum):
    """Types of templates."""
    DOCUMENT = "document"
    WORKFLOW = "workflow"
    EMAIL = "email"
    REPORT = "report"
    PRESENTATION = "presentation"
    FORM = "form"
    PAGE = "page"
    COMPONENT = "component"
    CUSTOM = "custom"


class VariableType(Enum):
    """Types of template variables."""
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    LIST = "list"
    OBJECT = "object"
    RICH_TEXT = "rich_text"
    IMAGE = "image"
    FILE = "file"
    USER = "user"
    CHOICE = "choice"


class TemplateStatus(Enum):
    """Template status."""
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    DEPRECATED = "deprecated"


class BlueprintStatus(Enum):
    """Blueprint status."""
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class RenderMode(Enum):
    """Template render modes."""
    PREVIEW = "preview"
    PRODUCTION = "production"
    DEBUG = "debug"


# ==================== Data Classes ====================

@dataclass
class TemplateVariable:
    """A template variable definition."""
    name: str
    var_type: VariableType
    label: str = ""
    description: str = ""
    default_value: Any = None
    required: bool = False
    validation_pattern: Optional[str] = None
    choices: List[Any] = field(default_factory=list)
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None

    def validate(self, value: Any) -> Tuple[bool, Optional[str]]:
        """Validate a value against this variable definition."""
        if value is None:
            if self.required:
                return False, f"Variable '{self.name}' is required"
            return True, None

        # Type validation
        if self.var_type == VariableType.STRING:
            if not isinstance(value, str):
                return False, f"Variable '{self.name}' must be a string"
            if self.min_length and len(value) < self.min_length:
                return False, f"Variable '{self.name}' must be at least {self.min_length} characters"
            if self.max_length and len(value) > self.max_length:
                return False, f"Variable '{self.name}' must be at most {self.max_length} characters"
            if self.validation_pattern:
                if not re.match(self.validation_pattern, value):
                    return False, f"Variable '{self.name}' does not match required pattern"

        elif self.var_type == VariableType.NUMBER:
            if not isinstance(value, (int, float)):
                return False, f"Variable '{self.name}' must be a number"
            if self.min_value is not None and value < self.min_value:
                return False, f"Variable '{self.name}' must be at least {self.min_value}"
            if self.max_value is not None and value > self.max_value:
                return False, f"Variable '{self.name}' must be at most {self.max_value}"

        elif self.var_type == VariableType.BOOLEAN:
            if not isinstance(value, bool):
                return False, f"Variable '{self.name}' must be a boolean"

        elif self.var_type == VariableType.CHOICE:
            if self.choices and value not in self.choices:
                return False, f"Variable '{self.name}' must be one of: {self.choices}"

        elif self.var_type == VariableType.LIST:
            if not isinstance(value, list):
                return False, f"Variable '{self.name}' must be a list"

        elif self.var_type == VariableType.OBJECT:
            if not isinstance(value, dict):
                return False, f"Variable '{self.name}' must be an object"

        return True, None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "type": self.var_type.value,
            "label": self.label or self.name,
            "description": self.description,
            "default_value": self.default_value,
            "required": self.required,
            "choices": self.choices if self.choices else None,
        }


@dataclass
class TemplateSection:
    """A section within a template."""
    id: str
    name: str
    content: str = ""
    order: int = 0
    variables: List[str] = field(default_factory=list)  # Variable names used
    conditional: Optional[str] = None  # Condition expression
    repeatable: bool = False
    repeat_variable: Optional[str] = None


@dataclass
class TemplateVersion:
    """A version of a template."""
    version: str
    content: str
    variables: List[TemplateVariable]
    created_at: datetime = field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    change_notes: str = ""
    is_published: bool = False


@dataclass
class Template:
    """A reusable template."""
    id: str
    name: str
    template_type: TemplateType
    content: str = ""
    description: str = ""
    variables: List[TemplateVariable] = field(default_factory=list)
    sections: List[TemplateSection] = field(default_factory=list)
    status: TemplateStatus = TemplateStatus.DRAFT
    category: str = ""
    tags: Set[str] = field(default_factory=set)
    parent_id: Optional[str] = None  # For inheritance
    workspace_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    version: str = "1.0.0"
    versions: List[TemplateVersion] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_variable(self, name: str) -> Optional[TemplateVariable]:
        """Get a variable by name."""
        for var in self.variables:
            if var.name == name:
                return var
        return None

    def add_variable(self, variable: TemplateVariable) -> None:
        """Add a variable to the template."""
        # Remove existing with same name
        self.variables = [v for v in self.variables if v.name != variable.name]
        self.variables.append(variable)
        self.updated_at = datetime.utcnow()

    def remove_variable(self, name: str) -> bool:
        """Remove a variable from the template."""
        original_len = len(self.variables)
        self.variables = [v for v in self.variables if v.name != name]
        if len(self.variables) < original_len:
            self.updated_at = datetime.utcnow()
            return True
        return False

    def validate_values(self, values: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate values against template variables."""
        errors = []
        for variable in self.variables:
            value = values.get(variable.name, variable.default_value)
            is_valid, error = variable.validate(value)
            if not is_valid:
                errors.append(error)
        return len(errors) == 0, errors

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "type": self.template_type.value,
            "description": self.description,
            "status": self.status.value,
            "category": self.category,
            "tags": list(self.tags),
            "version": self.version,
            "variables": [v.to_dict() for v in self.variables],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class BlueprintComponent:
    """A component within a blueprint."""
    id: str
    name: str
    template_id: str
    order: int = 0
    config: Dict[str, Any] = field(default_factory=dict)
    variable_mappings: Dict[str, str] = field(default_factory=dict)  # local -> template var
    conditional: Optional[str] = None
    children: List[str] = field(default_factory=list)  # Child component IDs


@dataclass
class Blueprint:
    """A blueprint combining multiple templates."""
    id: str
    name: str
    description: str = ""
    components: List[BlueprintComponent] = field(default_factory=list)
    variables: List[TemplateVariable] = field(default_factory=list)
    status: BlueprintStatus = BlueprintStatus.DRAFT
    category: str = ""
    tags: Set[str] = field(default_factory=set)
    workspace_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_component(self, component: BlueprintComponent) -> None:
        """Add a component to the blueprint."""
        self.components.append(component)
        self.updated_at = datetime.utcnow()

    def remove_component(self, component_id: str) -> bool:
        """Remove a component from the blueprint."""
        original_len = len(self.components)
        self.components = [c for c in self.components if c.id != component_id]
        if len(self.components) < original_len:
            self.updated_at = datetime.utcnow()
            return True
        return False

    def get_component(self, component_id: str) -> Optional[BlueprintComponent]:
        """Get a component by ID."""
        for component in self.components:
            if component.id == component_id:
                return component
        return None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status.value,
            "category": self.category,
            "tags": list(self.tags),
            "components": [
                {"id": c.id, "name": c.name, "template_id": c.template_id}
                for c in self.components
            ],
            "variables": [v.to_dict() for v in self.variables],
        }


@dataclass
class RenderResult:
    """Result of template rendering."""
    success: bool
    content: str = ""
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    used_variables: Set[str] = field(default_factory=set)
    render_time_ms: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TemplateInstance:
    """An instance created from a template."""
    id: str
    template_id: str
    template_version: str
    values: Dict[str, Any]
    rendered_content: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    workspace_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


# ==================== Template Engine ====================

class TemplateEngine:
    """Engine for rendering templates."""

    # Patterns for variable substitution
    SIMPLE_VAR_PATTERN = re.compile(r'\{\{\s*(\w+)\s*\}\}')
    FILTER_VAR_PATTERN = re.compile(r'\{\{\s*(\w+)\s*\|\s*(\w+)\s*\}\}')
    CONDITIONAL_PATTERN = re.compile(r'\{%\s*if\s+(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}', re.DOTALL)
    LOOP_PATTERN = re.compile(r'\{%\s*for\s+(\w+)\s+in\s+(\w+)\s*%\}(.*?)\{%\s*endfor\s*%\}', re.DOTALL)

    def __init__(self):
        self._filters: Dict[str, Callable[[Any], Any]] = {
            'upper': lambda x: str(x).upper(),
            'lower': lambda x: str(x).lower(),
            'title': lambda x: str(x).title(),
            'strip': lambda x: str(x).strip(),
            'default': lambda x: x if x else '',
            'json': lambda x: json.dumps(x),
            'length': lambda x: len(x) if hasattr(x, '__len__') else 0,
            'first': lambda x: x[0] if x else '',
            'last': lambda x: x[-1] if x else '',
            'join': lambda x: ', '.join(str(i) for i in x) if isinstance(x, list) else str(x),
        }
        self._helpers: Dict[str, Callable] = {}

    def register_filter(self, name: str, func: Callable[[Any], Any]) -> None:
        """Register a custom filter."""
        self._filters[name] = func

    def register_helper(self, name: str, func: Callable) -> None:
        """Register a custom helper function."""
        self._helpers[name] = func

    def render(
        self,
        template: Template,
        values: Dict[str, Any],
        mode: RenderMode = RenderMode.PRODUCTION
    ) -> RenderResult:
        """Render a template with given values."""
        start_time = time.time()
        errors = []
        warnings = []
        used_variables = set()

        # Validate values
        is_valid, validation_errors = template.validate_values(values)
        if not is_valid:
            if mode == RenderMode.PRODUCTION:
                return RenderResult(
                    success=False,
                    errors=validation_errors,
                    render_time_ms=(time.time() - start_time) * 1000
                )
            else:
                warnings.extend(validation_errors)

        # Prepare values with defaults
        prepared_values = self._prepare_values(template, values)

        # Render content
        try:
            content = template.content

            # Process conditionals
            content = self._process_conditionals(content, prepared_values, used_variables)

            # Process loops
            content = self._process_loops(content, prepared_values, used_variables)

            # Process variables with filters
            content = self._process_filtered_variables(content, prepared_values, used_variables)

            # Process simple variables
            content = self._process_simple_variables(content, prepared_values, used_variables)

            # Check for unresolved variables
            unresolved = self.SIMPLE_VAR_PATTERN.findall(content)
            if unresolved:
                for var in unresolved:
                    warnings.append(f"Unresolved variable: {var}")

            render_time = (time.time() - start_time) * 1000

            return RenderResult(
                success=True,
                content=content,
                errors=errors,
                warnings=warnings,
                used_variables=used_variables,
                render_time_ms=render_time
            )

        except Exception as e:
            return RenderResult(
                success=False,
                errors=[str(e)],
                render_time_ms=(time.time() - start_time) * 1000
            )

    def _prepare_values(
        self,
        template: Template,
        values: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Prepare values with defaults."""
        prepared = {}
        for variable in template.variables:
            if variable.name in values:
                prepared[variable.name] = values[variable.name]
            elif variable.default_value is not None:
                prepared[variable.name] = variable.default_value
        # Include any extra values not defined in template
        for key, value in values.items():
            if key not in prepared:
                prepared[key] = value
        return prepared

    def _process_simple_variables(
        self,
        content: str,
        values: Dict[str, Any],
        used: Set[str]
    ) -> str:
        """Process simple variable substitutions."""
        def replace(match):
            var_name = match.group(1)
            used.add(var_name)
            if var_name in values:
                return str(values[var_name])
            return match.group(0)  # Keep original if not found

        return self.SIMPLE_VAR_PATTERN.sub(replace, content)

    def _process_filtered_variables(
        self,
        content: str,
        values: Dict[str, Any],
        used: Set[str]
    ) -> str:
        """Process variables with filters."""
        def replace(match):
            var_name = match.group(1)
            filter_name = match.group(2)
            used.add(var_name)

            value = values.get(var_name, '')
            if filter_name in self._filters:
                try:
                    value = self._filters[filter_name](value)
                except Exception:
                    pass
            return str(value)

        return self.FILTER_VAR_PATTERN.sub(replace, content)

    def _process_conditionals(
        self,
        content: str,
        values: Dict[str, Any],
        used: Set[str]
    ) -> str:
        """Process conditional blocks."""
        def replace(match):
            condition_var = match.group(1)
            block_content = match.group(2)
            used.add(condition_var)

            # Evaluate condition
            condition_value = values.get(condition_var, False)
            if condition_value:
                return block_content
            return ''

        return self.CONDITIONAL_PATTERN.sub(replace, content)

    def _process_loops(
        self,
        content: str,
        values: Dict[str, Any],
        used: Set[str]
    ) -> str:
        """Process loop blocks."""
        def replace(match):
            item_var = match.group(1)
            list_var = match.group(2)
            block_content = match.group(3)
            used.add(list_var)

            # Get list value
            list_value = values.get(list_var, [])
            if not isinstance(list_value, list):
                return ''

            # Render for each item
            result = []
            for item in list_value:
                item_content = block_content
                # Replace item variable
                item_content = re.sub(
                    r'\{\{\s*' + item_var + r'\s*\}\}',
                    str(item),
                    item_content
                )
                # Handle item properties if dict
                if isinstance(item, dict):
                    for key, val in item.items():
                        item_content = re.sub(
                            r'\{\{\s*' + item_var + r'\.' + key + r'\s*\}\}',
                            str(val),
                            item_content
                        )
                result.append(item_content)

            return ''.join(result)

        return self.LOOP_PATTERN.sub(replace, content)

    def preview(
        self,
        template: Template,
        sample_values: Optional[Dict[str, Any]] = None
    ) -> RenderResult:
        """Preview a template with sample values."""
        if sample_values is None:
            sample_values = self._generate_sample_values(template)

        return self.render(template, sample_values, RenderMode.PREVIEW)

    def _generate_sample_values(self, template: Template) -> Dict[str, Any]:
        """Generate sample values for preview."""
        values = {}
        for variable in template.variables:
            if variable.default_value is not None:
                values[variable.name] = variable.default_value
            elif variable.var_type == VariableType.STRING:
                values[variable.name] = f"[{variable.label or variable.name}]"
            elif variable.var_type == VariableType.NUMBER:
                values[variable.name] = 0
            elif variable.var_type == VariableType.BOOLEAN:
                values[variable.name] = True
            elif variable.var_type == VariableType.LIST:
                values[variable.name] = ["Item 1", "Item 2"]
            elif variable.var_type == VariableType.CHOICE and variable.choices:
                values[variable.name] = variable.choices[0]
            else:
                values[variable.name] = f"[{variable.name}]"
        return values


# ==================== Template Registry ====================

class TemplateRegistry:
    """Central registry for managing templates."""

    _counter: int = 0

    def __init__(self):
        self._templates: Dict[str, Template] = {}
        self._blueprints: Dict[str, Blueprint] = {}
        self._instances: Dict[str, TemplateInstance] = {}
        self._categories: Dict[str, Set[str]] = {}  # category -> template_ids
        self._workspace_templates: Dict[str, Set[str]] = {}  # workspace -> template_ids

    def register_template(
        self,
        name: str,
        template_type: TemplateType,
        content: str = "",
        workspace_id: Optional[str] = None,
        **kwargs
    ) -> Template:
        """Register a new template."""
        TemplateRegistry._counter += 1
        template_id = f"tpl_{int(time.time() * 1000)}_{TemplateRegistry._counter}"

        template = Template(
            id=template_id,
            name=name,
            template_type=template_type,
            content=content,
            workspace_id=workspace_id,
            **kwargs
        )

        self._templates[template_id] = template

        # Index by category
        if template.category:
            if template.category not in self._categories:
                self._categories[template.category] = set()
            self._categories[template.category].add(template_id)

        # Index by workspace
        if workspace_id:
            if workspace_id not in self._workspace_templates:
                self._workspace_templates[workspace_id] = set()
            self._workspace_templates[workspace_id].add(template_id)

        return template

    def get_template(self, template_id: str) -> Optional[Template]:
        """Get a template by ID."""
        return self._templates.get(template_id)

    def update_template(self, template: Template) -> bool:
        """Update a template."""
        if template.id not in self._templates:
            return False

        template.updated_at = datetime.utcnow()
        self._templates[template.id] = template
        return True

    def delete_template(self, template_id: str) -> bool:
        """Delete a template."""
        template = self._templates.get(template_id)
        if not template:
            return False

        # Remove from indexes
        if template.category and template.category in self._categories:
            self._categories[template.category].discard(template_id)

        if template.workspace_id and template.workspace_id in self._workspace_templates:
            self._workspace_templates[template.workspace_id].discard(template_id)

        del self._templates[template_id]
        return True

    def list_templates(
        self,
        workspace_id: Optional[str] = None,
        template_type: Optional[TemplateType] = None,
        category: Optional[str] = None,
        status: Optional[TemplateStatus] = None,
        tags: Optional[Set[str]] = None
    ) -> List[Template]:
        """List templates matching criteria."""
        templates = list(self._templates.values())

        if workspace_id:
            templates = [t for t in templates if t.workspace_id == workspace_id]

        if template_type:
            templates = [t for t in templates if t.template_type == template_type]

        if category:
            templates = [t for t in templates if t.category == category]

        if status:
            templates = [t for t in templates if t.status == status]

        if tags:
            templates = [t for t in templates if tags.issubset(t.tags)]

        return templates

    def search_templates(
        self,
        query: str,
        workspace_id: Optional[str] = None
    ) -> List[Template]:
        """Search templates by name or description."""
        query_lower = query.lower()
        templates = self.list_templates(workspace_id=workspace_id)

        results = []
        for template in templates:
            if (query_lower in template.name.lower() or
                query_lower in template.description.lower() or
                any(query_lower in tag.lower() for tag in template.tags)):
                results.append(template)

        return results

    def clone_template(
        self,
        template_id: str,
        new_name: str,
        workspace_id: Optional[str] = None
    ) -> Optional[Template]:
        """Clone an existing template."""
        original = self._templates.get(template_id)
        if not original:
            return None

        TemplateRegistry._counter += 1
        new_id = f"tpl_{int(time.time() * 1000)}_{TemplateRegistry._counter}"

        cloned = Template(
            id=new_id,
            name=new_name,
            template_type=original.template_type,
            content=original.content,
            description=original.description,
            variables=copy.deepcopy(original.variables),
            sections=copy.deepcopy(original.sections),
            status=TemplateStatus.DRAFT,
            category=original.category,
            tags=original.tags.copy(),
            parent_id=original.id,
            workspace_id=workspace_id or original.workspace_id,
            metadata=copy.deepcopy(original.metadata)
        )

        self._templates[new_id] = cloned

        if cloned.workspace_id:
            if cloned.workspace_id not in self._workspace_templates:
                self._workspace_templates[cloned.workspace_id] = set()
            self._workspace_templates[cloned.workspace_id].add(new_id)

        return cloned

    def publish_template(self, template_id: str) -> bool:
        """Publish a template."""
        template = self._templates.get(template_id)
        if not template:
            return False

        template.status = TemplateStatus.PUBLISHED
        template.updated_at = datetime.utcnow()

        # Create version snapshot
        version = TemplateVersion(
            version=template.version,
            content=template.content,
            variables=copy.deepcopy(template.variables),
            is_published=True
        )
        template.versions.append(version)

        return True

    def archive_template(self, template_id: str) -> bool:
        """Archive a template."""
        template = self._templates.get(template_id)
        if not template:
            return False

        template.status = TemplateStatus.ARCHIVED
        template.updated_at = datetime.utcnow()
        return True

    def get_categories(self) -> List[str]:
        """Get all template categories."""
        return list(self._categories.keys())

    def get_templates_by_category(self, category: str) -> List[Template]:
        """Get templates in a category."""
        template_ids = self._categories.get(category, set())
        return [self._templates[tid] for tid in template_ids if tid in self._templates]

    # Blueprint methods
    def register_blueprint(
        self,
        name: str,
        workspace_id: Optional[str] = None,
        **kwargs
    ) -> Blueprint:
        """Register a new blueprint."""
        TemplateRegistry._counter += 1
        blueprint_id = f"bp_{int(time.time() * 1000)}_{TemplateRegistry._counter}"

        blueprint = Blueprint(
            id=blueprint_id,
            name=name,
            workspace_id=workspace_id,
            **kwargs
        )

        self._blueprints[blueprint_id] = blueprint
        return blueprint

    def get_blueprint(self, blueprint_id: str) -> Optional[Blueprint]:
        """Get a blueprint by ID."""
        return self._blueprints.get(blueprint_id)

    def update_blueprint(self, blueprint: Blueprint) -> bool:
        """Update a blueprint."""
        if blueprint.id not in self._blueprints:
            return False

        blueprint.updated_at = datetime.utcnow()
        self._blueprints[blueprint.id] = blueprint
        return True

    def delete_blueprint(self, blueprint_id: str) -> bool:
        """Delete a blueprint."""
        if blueprint_id in self._blueprints:
            del self._blueprints[blueprint_id]
            return True
        return False

    def list_blueprints(
        self,
        workspace_id: Optional[str] = None,
        status: Optional[BlueprintStatus] = None
    ) -> List[Blueprint]:
        """List blueprints matching criteria."""
        blueprints = list(self._blueprints.values())

        if workspace_id:
            blueprints = [b for b in blueprints if b.workspace_id == workspace_id]

        if status:
            blueprints = [b for b in blueprints if b.status == status]

        return blueprints

    # Instance methods
    def create_instance(
        self,
        template_id: str,
        values: Dict[str, Any],
        workspace_id: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> Optional[TemplateInstance]:
        """Create an instance from a template."""
        template = self._templates.get(template_id)
        if not template:
            return None

        TemplateRegistry._counter += 1
        instance_id = f"inst_{int(time.time() * 1000)}_{TemplateRegistry._counter}"

        engine = TemplateEngine()
        result = engine.render(template, values)

        instance = TemplateInstance(
            id=instance_id,
            template_id=template_id,
            template_version=template.version,
            values=values,
            rendered_content=result.content if result.success else "",
            workspace_id=workspace_id,
            created_by=created_by
        )

        self._instances[instance_id] = instance
        return instance

    def get_instance(self, instance_id: str) -> Optional[TemplateInstance]:
        """Get an instance by ID."""
        return self._instances.get(instance_id)

    def list_instances(
        self,
        template_id: Optional[str] = None,
        workspace_id: Optional[str] = None
    ) -> List[TemplateInstance]:
        """List template instances."""
        instances = list(self._instances.values())

        if template_id:
            instances = [i for i in instances if i.template_id == template_id]

        if workspace_id:
            instances = [i for i in instances if i.workspace_id == workspace_id]

        return instances


# ==================== Blueprint Renderer ====================

class BlueprintRenderer:
    """Renders blueprints by combining multiple templates."""

    def __init__(self, registry: TemplateRegistry):
        self.registry = registry
        self.engine = TemplateEngine()

    def render(
        self,
        blueprint: Blueprint,
        values: Dict[str, Any]
    ) -> RenderResult:
        """Render a blueprint."""
        start_time = time.time()
        errors = []
        warnings = []
        used_variables = set()
        rendered_parts = []

        # Validate blueprint-level values
        for variable in blueprint.variables:
            value = values.get(variable.name, variable.default_value)
            is_valid, error = variable.validate(value)
            if not is_valid:
                errors.append(error)

        if errors:
            return RenderResult(
                success=False,
                errors=errors,
                render_time_ms=(time.time() - start_time) * 1000
            )

        # Sort components by order
        sorted_components = sorted(blueprint.components, key=lambda c: c.order)

        # Render each component
        for component in sorted_components:
            # Check conditional
            if component.conditional:
                condition_value = values.get(component.conditional, False)
                if not condition_value:
                    continue

            # Get template
            template = self.registry.get_template(component.template_id)
            if not template:
                warnings.append(f"Template not found: {component.template_id}")
                continue

            # Map variables
            component_values = {}
            for local_var, template_var in component.variable_mappings.items():
                if local_var in values:
                    component_values[template_var] = values[local_var]

            # Add any direct values from component config
            component_values.update(component.config)

            # Render template
            result = self.engine.render(template, component_values)
            if result.success:
                rendered_parts.append({
                    "component_id": component.id,
                    "component_name": component.name,
                    "content": result.content
                })
                used_variables.update(result.used_variables)
            else:
                warnings.extend(result.errors)

        # Combine rendered parts
        combined_content = "\n".join(p["content"] for p in rendered_parts)

        return RenderResult(
            success=True,
            content=combined_content,
            errors=errors,
            warnings=warnings,
            used_variables=used_variables,
            render_time_ms=(time.time() - start_time) * 1000,
            metadata={"parts": rendered_parts}
        )


# ==================== Template Builder ====================

class TemplateBuilder:
    """Builder for creating templates fluently."""

    def __init__(self, name: str, template_type: TemplateType):
        self._name = name
        self._type = template_type
        self._content = ""
        self._description = ""
        self._variables: List[TemplateVariable] = []
        self._sections: List[TemplateSection] = []
        self._category = ""
        self._tags: Set[str] = set()
        self._metadata: Dict[str, Any] = {}

    def with_content(self, content: str) -> 'TemplateBuilder':
        """Set template content."""
        self._content = content
        return self

    def with_description(self, description: str) -> 'TemplateBuilder':
        """Set template description."""
        self._description = description
        return self

    def with_category(self, category: str) -> 'TemplateBuilder':
        """Set template category."""
        self._category = category
        return self

    def with_tags(self, *tags: str) -> 'TemplateBuilder':
        """Add tags to template."""
        self._tags.update(tags)
        return self

    def add_string_variable(
        self,
        name: str,
        label: str = "",
        required: bool = False,
        default: str = ""
    ) -> 'TemplateBuilder':
        """Add a string variable."""
        self._variables.append(TemplateVariable(
            name=name,
            var_type=VariableType.STRING,
            label=label or name,
            required=required,
            default_value=default if default else None
        ))
        return self

    def add_number_variable(
        self,
        name: str,
        label: str = "",
        required: bool = False,
        default: Optional[float] = None,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None
    ) -> 'TemplateBuilder':
        """Add a number variable."""
        self._variables.append(TemplateVariable(
            name=name,
            var_type=VariableType.NUMBER,
            label=label or name,
            required=required,
            default_value=default,
            min_value=min_value,
            max_value=max_value
        ))
        return self

    def add_boolean_variable(
        self,
        name: str,
        label: str = "",
        default: bool = False
    ) -> 'TemplateBuilder':
        """Add a boolean variable."""
        self._variables.append(TemplateVariable(
            name=name,
            var_type=VariableType.BOOLEAN,
            label=label or name,
            default_value=default
        ))
        return self

    def add_choice_variable(
        self,
        name: str,
        choices: List[Any],
        label: str = "",
        required: bool = False,
        default: Any = None
    ) -> 'TemplateBuilder':
        """Add a choice variable."""
        self._variables.append(TemplateVariable(
            name=name,
            var_type=VariableType.CHOICE,
            label=label or name,
            required=required,
            default_value=default,
            choices=choices
        ))
        return self

    def add_list_variable(
        self,
        name: str,
        label: str = "",
        required: bool = False
    ) -> 'TemplateBuilder':
        """Add a list variable."""
        self._variables.append(TemplateVariable(
            name=name,
            var_type=VariableType.LIST,
            label=label or name,
            required=required
        ))
        return self

    def add_section(
        self,
        section_id: str,
        name: str,
        content: str,
        order: int = 0
    ) -> 'TemplateBuilder':
        """Add a section to the template."""
        self._sections.append(TemplateSection(
            id=section_id,
            name=name,
            content=content,
            order=order
        ))
        return self

    def with_metadata(self, key: str, value: Any) -> 'TemplateBuilder':
        """Add metadata to template."""
        self._metadata[key] = value
        return self

    def build(self) -> Template:
        """Build the template."""
        TemplateRegistry._counter += 1
        template_id = f"tpl_{int(time.time() * 1000)}_{TemplateRegistry._counter}"

        return Template(
            id=template_id,
            name=self._name,
            template_type=self._type,
            content=self._content,
            description=self._description,
            variables=self._variables,
            sections=self._sections,
            category=self._category,
            tags=self._tags,
            metadata=self._metadata
        )


# ==================== Template Manager ====================

class TemplateManager:
    """High-level manager for templates."""

    def __init__(self):
        self.registry = TemplateRegistry()
        self.engine = TemplateEngine()
        self.blueprint_renderer = BlueprintRenderer(self.registry)

    def create_template(
        self,
        name: str,
        template_type: TemplateType,
        content: str = "",
        workspace_id: Optional[str] = None,
        **kwargs
    ) -> Template:
        """Create a new template."""
        return self.registry.register_template(
            name=name,
            template_type=template_type,
            content=content,
            workspace_id=workspace_id,
            **kwargs
        )

    def get_template(self, template_id: str) -> Optional[Template]:
        """Get a template by ID."""
        return self.registry.get_template(template_id)

    def render_template(
        self,
        template_id: str,
        values: Dict[str, Any],
        mode: RenderMode = RenderMode.PRODUCTION
    ) -> RenderResult:
        """Render a template."""
        template = self.registry.get_template(template_id)
        if not template:
            return RenderResult(
                success=False,
                errors=[f"Template not found: {template_id}"]
            )

        return self.engine.render(template, values, mode)

    def preview_template(
        self,
        template_id: str,
        sample_values: Optional[Dict[str, Any]] = None
    ) -> RenderResult:
        """Preview a template."""
        template = self.registry.get_template(template_id)
        if not template:
            return RenderResult(
                success=False,
                errors=[f"Template not found: {template_id}"]
            )

        return self.engine.preview(template, sample_values)

    def create_blueprint(
        self,
        name: str,
        workspace_id: Optional[str] = None,
        **kwargs
    ) -> Blueprint:
        """Create a new blueprint."""
        return self.registry.register_blueprint(
            name=name,
            workspace_id=workspace_id,
            **kwargs
        )

    def render_blueprint(
        self,
        blueprint_id: str,
        values: Dict[str, Any]
    ) -> RenderResult:
        """Render a blueprint."""
        blueprint = self.registry.get_blueprint(blueprint_id)
        if not blueprint:
            return RenderResult(
                success=False,
                errors=[f"Blueprint not found: {blueprint_id}"]
            )

        return self.blueprint_renderer.render(blueprint, values)

    def create_from_template(
        self,
        template_id: str,
        values: Dict[str, Any],
        workspace_id: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> Optional[TemplateInstance]:
        """Create an instance from a template."""
        return self.registry.create_instance(
            template_id=template_id,
            values=values,
            workspace_id=workspace_id,
            created_by=created_by
        )

    def list_templates(self, **kwargs) -> List[Template]:
        """List templates."""
        return self.registry.list_templates(**kwargs)

    def list_blueprints(self, **kwargs) -> List[Blueprint]:
        """List blueprints."""
        return self.registry.list_blueprints(**kwargs)

    def search(self, query: str, workspace_id: Optional[str] = None) -> List[Template]:
        """Search templates."""
        return self.registry.search_templates(query, workspace_id)

    def get_stats(self) -> Dict[str, Any]:
        """Get template system stats."""
        return {
            "total_templates": len(self.registry._templates),
            "total_blueprints": len(self.registry._blueprints),
            "total_instances": len(self.registry._instances),
            "categories": len(self.registry._categories),
            "templates_by_type": {
                t.value: len([
                    tpl for tpl in self.registry._templates.values()
                    if tpl.template_type == t
                ])
                for t in TemplateType
            }
        }


# ==================== Global Instances ====================

_template_manager: Optional[TemplateManager] = None


def get_template_manager() -> Optional[TemplateManager]:
    """Get the global template manager."""
    return _template_manager


def set_template_manager(manager: TemplateManager) -> None:
    """Set the global template manager."""
    global _template_manager
    _template_manager = manager


def reset_template_manager() -> None:
    """Reset the global template manager."""
    global _template_manager
    _template_manager = None
