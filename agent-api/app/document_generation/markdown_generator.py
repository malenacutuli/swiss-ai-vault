"""
Markdown document generator.

Generates Markdown documents with:
- Headings
- Lists (bullet and numbered)
- Tables
- Code blocks
- Emphasis and formatting
"""

import os
from typing import Dict, Any

from .base import DocumentGenerator, DocumentContent


class MarkdownGenerator(DocumentGenerator):
    """Generator for Markdown (.md) documents."""

    def __init__(self, content: DocumentContent):
        """
        Initialize Markdown generator.

        Args:
            content: DocumentContent with title and sections
        """
        super().__init__(content)
        self.markdown_content = []

    def get_format_name(self) -> str:
        """Return format name."""
        return "markdown"

    def validate_content(self) -> bool:
        """
        Validate content structure for Markdown generation.

        Returns:
            bool: True if valid

        Raises:
            ValueError: If content is invalid
        """
        if not self.content.title:
            raise ValueError("Document title is required")

        if not self.content.sections:
            raise ValueError("At least one section is required")

        for idx, section in enumerate(self.content.sections):
            if "heading" not in section:
                raise ValueError(f"Section {idx} missing 'heading' field")

        return True

    def generate(self, output_path: str) -> str:
        """
        Generate Markdown document.

        Args:
            output_path: Path to save the document

        Returns:
            str: Path to generated document
        """
        self.validate_content()

        # Build markdown content
        self._build_markdown()

        # Write to file
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(self.markdown_content))

        # Update metadata
        file_size = os.path.getsize(output_path)
        self.update_metadata(file_size=file_size)

        return output_path

    def _build_markdown(self):
        """Build markdown content."""
        # Add title
        self.markdown_content.append(f"# {self.content.title}")
        self.markdown_content.append("")

        # Add metadata if present
        if self.content.metadata:
            author = self.content.metadata.get("author", "Swiss AI Vault Agent")
            created_at = self.content.metadata.get("created_at", "")
            self.markdown_content.append(f"*By {author} | {created_at}*")
            self.markdown_content.append("")
            self.markdown_content.append("---")
            self.markdown_content.append("")

        # Add sections
        for section in self.content.sections:
            self._add_section(section)

    def _add_section(self, section: Dict[str, Any]):
        """
        Add a section to markdown content.

        Args:
            section: Section data
        """
        # Add section heading
        heading = section.get("heading", "Section")
        self.markdown_content.append(f"## {heading}")
        self.markdown_content.append("")

        # Add content based on type
        content_type = section.get("type", "text")

        if content_type == "text":
            self._add_text_content(section)

        elif content_type == "bullet_list":
            self._add_bullet_list(section)

        elif content_type == "numbered_list":
            self._add_numbered_list(section)

        elif content_type == "table":
            self._add_table(section)

        elif content_type == "code":
            self._add_code(section)

        # Add spacing after section
        self.markdown_content.append("")

    def _add_text_content(self, section: Dict[str, Any]):
        """Add text content."""
        content = section.get("content", "")

        if isinstance(content, list):
            for item in content:
                self.markdown_content.append(str(item))
                self.markdown_content.append("")
        else:
            self.markdown_content.append(str(content))
            self.markdown_content.append("")

    def _add_bullet_list(self, section: Dict[str, Any]):
        """Add bullet list."""
        items = section.get("items", [])

        for item in items:
            self.markdown_content.append(f"- {item}")

        self.markdown_content.append("")

    def _add_numbered_list(self, section: Dict[str, Any]):
        """Add numbered list."""
        items = section.get("items", [])

        for idx, item in enumerate(items, start=1):
            self.markdown_content.append(f"{idx}. {item}")

        self.markdown_content.append("")

    def _add_table(self, section: Dict[str, Any]):
        """Add table in markdown format."""
        headers = section.get("headers", [])
        rows = section.get("rows", [])

        if not headers or not rows:
            return

        # Add header row
        header_line = "| " + " | ".join(str(h) for h in headers) + " |"
        self.markdown_content.append(header_line)

        # Add separator row
        separator = "| " + " | ".join("---" for _ in headers) + " |"
        self.markdown_content.append(separator)

        # Add data rows
        for row in rows:
            row_line = "| " + " | ".join(str(cell) for cell in row) + " |"
            self.markdown_content.append(row_line)

        self.markdown_content.append("")

    def _add_code(self, section: Dict[str, Any]):
        """Add code block."""
        code = section.get("content", "")
        language = section.get("language", "")

        self.markdown_content.append(f"```{language}")
        self.markdown_content.append(code)
        self.markdown_content.append("```")
        self.markdown_content.append("")
