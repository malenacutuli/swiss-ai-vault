"""
Prompt Template System

Production-grade template management with variable substitution.
Enables consistent prompt patterns across the platform.
"""

import re
import logging
from typing import Dict, Any, List, Optional, Set
from datetime import datetime
from supabase import Client
import structlog

logger = structlog.get_logger()


class PromptTemplate:
    """Represents a prompt template with variable substitution."""

    def __init__(
        self,
        template_id: str,
        name: str,
        template: str,
        variables: List[str],
        description: Optional[str] = None,
        created_at: Optional[str] = None,
        id: Optional[str] = None
    ):
        """
        Initialize prompt template.

        Args:
            template_id: Unique template identifier
            name: Human-readable template name
            template: Template string with {{variable}} placeholders
            variables: List of required variable names
            description: Template description
            created_at: Creation timestamp
            id: Database ID
        """
        self.id = id
        self.template_id = template_id
        self.name = name
        self.template = template
        self.variables = variables
        self.description = description
        self.created_at = created_at or datetime.utcnow().isoformat()

    def render(self, values: Dict[str, Any]) -> str:
        """
        Render template with provided variable values.

        Args:
            values: Dictionary mapping variable names to values

        Returns:
            Rendered prompt string

        Raises:
            ValueError: If required variables are missing
        """
        # Validate all required variables are provided
        missing = set(self.variables) - set(values.keys())
        if missing:
            raise ValueError(f"Missing required variables: {missing}")

        # Render template
        rendered = self.template
        for var_name, var_value in values.items():
            placeholder = f"{{{{{var_name}}}}}"
            rendered = rendered.replace(placeholder, str(var_value))

        return rendered

    def extract_variables(self) -> Set[str]:
        """
        Extract variable names from template string.

        Returns:
            Set of variable names found in template
        """
        pattern = r'\{\{(\w+)\}\}'
        return set(re.findall(pattern, self.template))

    def validate_template(self) -> bool:
        """
        Validate template structure.

        Returns:
            True if valid

        Raises:
            ValueError: If template is invalid
        """
        # Extract variables from template
        extracted_vars = self.extract_variables()

        # Check if declared variables match extracted
        declared_set = set(self.variables)
        if extracted_vars != declared_set:
            extra = extracted_vars - declared_set
            missing = declared_set - extracted_vars

            error_parts = []
            if extra:
                error_parts.append(f"undeclared variables in template: {extra}")
            if missing:
                error_parts.append(f"declared but unused variables: {missing}")

            raise ValueError(f"Template validation failed: {', '.join(error_parts)}")

        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage/API."""
        return {
            "id": self.id,
            "template_id": self.template_id,
            "name": self.name,
            "template": self.template,
            "variables": self.variables,
            "description": self.description,
            "created_at": self.created_at
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PromptTemplate":
        """Create from dictionary."""
        return cls(
            id=data.get("id"),
            template_id=data["template_id"],
            name=data["name"],
            template=data["template"],
            variables=data.get("variables", []),
            description=data.get("description"),
            created_at=data.get("created_at")
        )


class PromptTemplateSystem:
    """
    Manage prompt templates with Supabase persistence.

    Provides CRUD operations and rendering for prompt templates.
    """

    def __init__(self, supabase: Client):
        """
        Initialize template system.

        Args:
            supabase: Supabase client for persistence
        """
        self.supabase = supabase
        self.table_name = "prompt_templates"

    async def create_template(
        self,
        template_id: str,
        name: str,
        template: str,
        description: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> PromptTemplate:
        """
        Create new prompt template.

        Args:
            template_id: Unique template identifier
            name: Human-readable template name
            template: Template string with {{variable}} placeholders
            description: Template description
            user_id: User creating the template

        Returns:
            Created prompt template

        Raises:
            ValueError: If template is invalid
        """
        # Extract variables from template
        pattern = r'\{\{(\w+)\}\}'
        variables = list(set(re.findall(pattern, template)))

        # Create template object
        prompt_template = PromptTemplate(
            template_id=template_id,
            name=name,
            template=template,
            variables=variables,
            description=description
        )

        # Validate template
        prompt_template.validate_template()

        # Prepare data for insertion
        template_data = {
            "template_id": template_id,
            "name": name,
            "template": template,
            "variables": variables,
            "description": description,
            "created_at": datetime.utcnow().isoformat(),
            "created_by": user_id
        }

        # Insert into database
        result = self.supabase.table(self.table_name).insert(template_data).execute()

        if not result.data:
            raise Exception("Failed to create prompt template")

        created_template = PromptTemplate.from_dict(result.data[0])

        logger.info(
            "prompt_template_created",
            template_id=template_id,
            name=name,
            variables=variables,
            user_id=user_id
        )

        return created_template

    async def get_template(self, template_id: str) -> Optional[PromptTemplate]:
        """
        Get prompt template by ID.

        Args:
            template_id: Template identifier

        Returns:
            Prompt template or None if not found
        """
        result = self.supabase.table(self.table_name).select("*").eq(
            "template_id", template_id
        ).execute()

        if not result.data:
            return None

        return PromptTemplate.from_dict(result.data[0])

    async def list_templates(self) -> List[PromptTemplate]:
        """
        List all prompt templates.

        Returns:
            List of prompt templates
        """
        result = self.supabase.table(self.table_name).select("*").order(
            "created_at", desc=True
        ).execute()

        return [PromptTemplate.from_dict(t) for t in result.data]

    async def update_template(
        self,
        template_id: str,
        name: Optional[str] = None,
        template: Optional[str] = None,
        description: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Optional[PromptTemplate]:
        """
        Update prompt template.

        Args:
            template_id: Template identifier
            name: New name (optional)
            template: New template string (optional)
            description: New description (optional)
            user_id: User updating the template

        Returns:
            Updated template or None if not found

        Raises:
            ValueError: If new template is invalid
        """
        # Get existing template
        existing = await self.get_template(template_id)
        if not existing:
            return None

        # Prepare update data
        update_data = {}

        if name is not None:
            update_data["name"] = name

        if template is not None:
            # Extract and validate new variables
            pattern = r'\{\{(\w+)\}\}'
            variables = list(set(re.findall(pattern, template)))

            # Validate new template
            temp_template = PromptTemplate(
                template_id=template_id,
                name=name or existing.name,
                template=template,
                variables=variables
            )
            temp_template.validate_template()

            update_data["template"] = template
            update_data["variables"] = variables

        if description is not None:
            update_data["description"] = description

        if not update_data:
            return existing

        update_data["updated_at"] = datetime.utcnow().isoformat()

        # Update in database
        result = self.supabase.table(self.table_name).update(update_data).eq(
            "template_id", template_id
        ).execute()

        if not result.data:
            return None

        updated_template = PromptTemplate.from_dict(result.data[0])

        logger.info(
            "prompt_template_updated",
            template_id=template_id,
            updated_fields=list(update_data.keys()),
            user_id=user_id
        )

        return updated_template

    async def delete_template(
        self,
        template_id: str,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Delete prompt template.

        Args:
            template_id: Template identifier
            user_id: User deleting the template

        Returns:
            Success status
        """
        result = self.supabase.table(self.table_name).delete().eq(
            "template_id", template_id
        ).execute()

        success = bool(result.data)

        if success:
            logger.info(
                "prompt_template_deleted",
                template_id=template_id,
                user_id=user_id
            )

        return success

    async def render_template(
        self,
        template_id: str,
        values: Dict[str, Any]
    ) -> Optional[str]:
        """
        Render template with provided values.

        Args:
            template_id: Template identifier
            values: Variable values

        Returns:
            Rendered prompt or None if template not found

        Raises:
            ValueError: If required variables are missing
        """
        template = await self.get_template(template_id)
        if not template:
            return None

        return template.render(values)
