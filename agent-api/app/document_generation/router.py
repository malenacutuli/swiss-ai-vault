"""
Document generation router.

Routes document generation requests to the appropriate format-specific generator.
"""

import os
from typing import Optional
from enum import Enum

from .base import DocumentContent, DocumentMetadata
from .docx_generator import DOCXGenerator
from .pptx_generator import PPTXGenerator
from .xlsx_generator import XLSXGenerator
from .pdf_generator import PDFGenerator
from .markdown_generator import MarkdownGenerator


class DocumentFormat(str, Enum):
    """Supported document formats."""
    DOCX = "docx"
    PPTX = "pptx"
    XLSX = "xlsx"
    PDF = "pdf"
    MARKDOWN = "markdown"


class DocumentGenerationRouter:
    """
    Routes document generation requests to format-specific generators.

    Usage:
        router = DocumentGenerationRouter()
        content = DocumentContent(title="Report", sections=[...])
        filepath = router.generate(content, DocumentFormat.DOCX, "/tmp/output.docx")
    """

    def __init__(self):
        """Initialize the router."""
        self._generators = {
            DocumentFormat.DOCX: DOCXGenerator,
            DocumentFormat.PPTX: PPTXGenerator,
            DocumentFormat.XLSX: XLSXGenerator,
            DocumentFormat.PDF: PDFGenerator,
            DocumentFormat.MARKDOWN: MarkdownGenerator,
        }

    def generate(
        self,
        content: DocumentContent,
        format: DocumentFormat,
        output_path: Optional[str] = None
    ) -> tuple[str, DocumentMetadata]:
        """
        Generate a document in the specified format.

        Args:
            content: Document content structure
            format: Target document format
            output_path: Optional output path. If not provided, uses /tmp/documents/

        Returns:
            tuple[str, DocumentMetadata]: (file_path, metadata)

        Raises:
            ValueError: If format is not supported or content is invalid
        """
        if format not in self._generators:
            raise ValueError(f"Unsupported format: {format}")

        # Generate output path if not provided
        if output_path is None:
            output_path = self._get_default_output_path(content.title, format)

        # Get generator class
        generator_class = self._generators[format]

        # Create generator instance
        generator = generator_class(content)

        # Generate document
        filepath = generator.generate(output_path)

        # Get metadata
        metadata = generator.get_metadata()

        return filepath, metadata

    def _get_default_output_path(self, title: str, format: DocumentFormat) -> str:
        """
        Generate default output path.

        Args:
            title: Document title
            format: Document format

        Returns:
            str: Default output path
        """
        # Sanitize title for filename
        safe_title = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in title)
        safe_title = safe_title.replace(' ', '_')[:50]  # Limit length

        # Create output directory
        output_dir = "/tmp/documents"
        os.makedirs(output_dir, exist_ok=True)

        # Generate filename
        filename = f"{safe_title}.{format.value}"
        output_path = os.path.join(output_dir, filename)

        return output_path

    def get_supported_formats(self) -> list[str]:
        """
        Get list of supported document formats.

        Returns:
            list[str]: List of format names
        """
        return [fmt.value for fmt in DocumentFormat]

    def validate_format(self, format: str) -> bool:
        """
        Check if a format is supported.

        Args:
            format: Format name to validate

        Returns:
            bool: True if format is supported
        """
        try:
            DocumentFormat(format.lower())
            return True
        except ValueError:
            return False
