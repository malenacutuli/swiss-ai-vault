"""
Base class for document generation.

Defines the abstract interface that all document generators must implement.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel


class DocumentMetadata(BaseModel):
    """Metadata for generated documents."""
    title: str
    author: Optional[str] = "Swiss AI Vault Agent"
    created_at: datetime
    format: str
    file_size: Optional[int] = None
    page_count: Optional[int] = None


class DocumentContent(BaseModel):
    """Standard content structure for document generation."""
    title: str
    sections: list[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = None


class DocumentGenerator(ABC):
    """
    Abstract base class for all document generators.

    Each format-specific generator must inherit from this class and implement:
    - generate() method to create the document
    - validate_content() method to validate input content
    - get_metadata() method to return document metadata
    """

    def __init__(self, content: DocumentContent):
        """
        Initialize the generator with content.

        Args:
            content: Validated DocumentContent object
        """
        self.content = content
        self.metadata = DocumentMetadata(
            title=content.title,
            created_at=datetime.utcnow(),
            format=self.get_format_name()
        )

    @abstractmethod
    def generate(self, output_path: str) -> str:
        """
        Generate the document and save to output_path.

        Args:
            output_path: Path where the document should be saved

        Returns:
            str: Path to the generated document

        Raises:
            Exception: If generation fails
        """
        pass

    @abstractmethod
    def validate_content(self) -> bool:
        """
        Validate that the content structure is appropriate for this format.

        Returns:
            bool: True if content is valid, False otherwise

        Raises:
            ValueError: If content is invalid with description of the issue
        """
        pass

    @abstractmethod
    def get_format_name(self) -> str:
        """
        Get the format name for this generator.

        Returns:
            str: Format name (e.g., 'docx', 'pdf', 'xlsx')
        """
        pass

    def get_metadata(self) -> DocumentMetadata:
        """
        Get metadata for the generated document.

        Returns:
            DocumentMetadata: Document metadata object
        """
        return self.metadata

    def update_metadata(self, **kwargs):
        """
        Update metadata fields.

        Args:
            **kwargs: Metadata fields to update
        """
        for key, value in kwargs.items():
            if hasattr(self.metadata, key):
                setattr(self.metadata, key, value)
