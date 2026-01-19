"""
Unit tests for document generation.

Tests all document generators (DOCX, PPTX, XLSX, PDF, Markdown).
"""

import os
import pytest
from datetime import datetime

from app.document_generation.base import DocumentContent
from app.document_generation.docx_generator import DOCXGenerator
from app.document_generation.pptx_generator import PPTXGenerator
from app.document_generation.xlsx_generator import XLSXGenerator
from app.document_generation.pdf_generator import PDFGenerator
from app.document_generation.markdown_generator import MarkdownGenerator
from app.document_generation.router import DocumentGenerationRouter, DocumentFormat


# Sample content for testing
@pytest.fixture
def sample_content():
    """Sample document content for testing."""
    return DocumentContent(
        title="Test Document",
        sections=[
            {
                "heading": "Introduction",
                "type": "text",
                "content": "This is a test document generated for unit testing."
            },
            {
                "heading": "Features",
                "type": "bullet_list",
                "items": [
                    "Multi-format document generation",
                    "DOCX, PPTX, XLSX, PDF, Markdown support",
                    "Automated testing"
                ]
            },
            {
                "heading": "Data Table",
                "type": "table",
                "headers": ["Name", "Value", "Status"],
                "rows": [
                    ["Test 1", "100", "Pass"],
                    ["Test 2", "200", "Pass"],
                    ["Test 3", "150", "Fail"]
                ]
            },
            {
                "heading": "Code Example",
                "type": "code",
                "language": "python",
                "content": "def hello():\n    print('Hello, World!')"
            }
        ],
        metadata={
            "author": "Test Suite",
            "created_at": datetime.utcnow().isoformat()
        }
    )


@pytest.fixture
def output_dir(tmp_path):
    """Temporary output directory for test files."""
    return str(tmp_path)


class TestDOCXGenerator:
    """Test DOCX document generator."""

    def test_generate_docx(self, sample_content, output_dir):
        """Test DOCX generation."""
        output_path = os.path.join(output_dir, "test.docx")
        generator = DOCXGenerator(sample_content)

        filepath = generator.generate(output_path)

        assert os.path.exists(filepath)
        assert filepath == output_path
        assert os.path.getsize(filepath) > 0

        metadata = generator.get_metadata()
        assert metadata.format == "docx"
        assert metadata.title == "Test Document"
        assert metadata.file_size > 0

    def test_validate_content_missing_title(self):
        """Test validation with missing title."""
        content = DocumentContent(title="", sections=[{"heading": "Test", "type": "text"}])
        generator = DOCXGenerator(content)

        with pytest.raises(ValueError, match="title is required"):
            generator.validate_content()

    def test_validate_content_missing_sections(self):
        """Test validation with no sections."""
        content = DocumentContent(title="Test", sections=[])
        generator = DOCXGenerator(content)

        with pytest.raises(ValueError, match="At least one section is required"):
            generator.validate_content()


class TestPPTXGenerator:
    """Test PPTX presentation generator."""

    def test_generate_pptx(self, sample_content, output_dir):
        """Test PPTX generation."""
        output_path = os.path.join(output_dir, "test.pptx")
        generator = PPTXGenerator(sample_content)

        filepath = generator.generate(output_path)

        assert os.path.exists(filepath)
        assert filepath == output_path
        assert os.path.getsize(filepath) > 0

        metadata = generator.get_metadata()
        assert metadata.format == "pptx"
        assert metadata.page_count >= 4  # Title + 3 content slides


class TestXLSXGenerator:
    """Test XLSX spreadsheet generator."""

    def test_generate_xlsx(self, sample_content, output_dir):
        """Test XLSX generation."""
        output_path = os.path.join(output_dir, "test.xlsx")
        generator = XLSXGenerator(sample_content)

        filepath = generator.generate(output_path)

        assert os.path.exists(filepath)
        assert filepath == output_path
        assert os.path.getsize(filepath) > 0

        metadata = generator.get_metadata()
        assert metadata.format == "xlsx"
        assert metadata.page_count >= 4  # Overview + section sheets


class TestPDFGenerator:
    """Test PDF document generator."""

    def test_generate_pdf(self, sample_content, output_dir):
        """Test PDF generation."""
        output_path = os.path.join(output_dir, "test.pdf")
        generator = PDFGenerator(sample_content)

        filepath = generator.generate(output_path)

        assert os.path.exists(filepath)
        assert filepath == output_path
        assert os.path.getsize(filepath) > 0

        metadata = generator.get_metadata()
        assert metadata.format == "pdf"


class TestMarkdownGenerator:
    """Test Markdown document generator."""

    def test_generate_markdown(self, sample_content, output_dir):
        """Test Markdown generation."""
        output_path = os.path.join(output_dir, "test.md")
        generator = MarkdownGenerator(sample_content)

        filepath = generator.generate(output_path)

        assert os.path.exists(filepath)
        assert filepath == output_path
        assert os.path.getsize(filepath) > 0

        # Read and verify content
        with open(filepath, 'r') as f:
            content = f.read()
            assert "# Test Document" in content
            assert "## Introduction" in content
            assert "## Features" in content

        metadata = generator.get_metadata()
        assert metadata.format == "markdown"


class TestDocumentGenerationRouter:
    """Test document generation router."""

    def test_generate_docx_via_router(self, sample_content, output_dir):
        """Test DOCX generation via router."""
        router = DocumentGenerationRouter()
        output_path = os.path.join(output_dir, "test_router.docx")

        filepath, metadata = router.generate(
            content=sample_content,
            format=DocumentFormat.DOCX,
            output_path=output_path
        )

        assert os.path.exists(filepath)
        assert metadata.format == "docx"

    def test_generate_all_formats(self, sample_content, output_dir):
        """Test generation of all formats."""
        router = DocumentGenerationRouter()

        formats = [
            (DocumentFormat.DOCX, "test.docx"),
            (DocumentFormat.PPTX, "test.pptx"),
            (DocumentFormat.XLSX, "test.xlsx"),
            (DocumentFormat.PDF, "test.pdf"),
            (DocumentFormat.MARKDOWN, "test.md")
        ]

        for format_type, filename in formats:
            output_path = os.path.join(output_dir, filename)
            filepath, metadata = router.generate(
                content=sample_content,
                format=format_type,
                output_path=output_path
            )

            assert os.path.exists(filepath)
            assert metadata.format == format_type.value

    def test_unsupported_format(self, sample_content):
        """Test error handling for unsupported format."""
        router = DocumentGenerationRouter()

        with pytest.raises(ValueError, match="Unsupported format"):
            router.generate(
                content=sample_content,
                format="unsupported_format",  # Invalid
                output_path="/tmp/test.txt"
            )

    def test_get_supported_formats(self):
        """Test getting supported formats."""
        router = DocumentGenerationRouter()
        formats = router.get_supported_formats()

        assert "docx" in formats
        assert "pptx" in formats
        assert "xlsx" in formats
        assert "pdf" in formats
        assert "markdown" in formats

    def test_validate_format(self):
        """Test format validation."""
        router = DocumentGenerationRouter()

        assert router.validate_format("docx") is True
        assert router.validate_format("PPTX") is True  # Case insensitive
        assert router.validate_format("invalid") is False

    def test_default_output_path(self, sample_content):
        """Test automatic output path generation."""
        router = DocumentGenerationRouter()

        filepath, metadata = router.generate(
            content=sample_content,
            format=DocumentFormat.DOCX
        )

        assert os.path.exists(filepath)
        assert filepath.startswith("/tmp/documents/")
        assert filepath.endswith(".docx")

        # Cleanup
        os.remove(filepath)


class TestContentStructures:
    """Test various content structures."""

    def test_numbered_list(self, output_dir):
        """Test numbered list generation."""
        content = DocumentContent(
            title="Numbered List Test",
            sections=[
                {
                    "heading": "Steps",
                    "type": "numbered_list",
                    "items": ["First step", "Second step", "Third step"]
                }
            ]
        )

        router = DocumentGenerationRouter()
        filepath, _ = router.generate(
            content=content,
            format=DocumentFormat.MARKDOWN,
            output_path=os.path.join(output_dir, "numbered.md")
        )

        with open(filepath, 'r') as f:
            text = f.read()
            assert "1. First step" in text
            assert "2. Second step" in text

    def test_empty_table(self, output_dir):
        """Test handling of empty table."""
        content = DocumentContent(
            title="Empty Table Test",
            sections=[
                {
                    "heading": "Data",
                    "type": "table",
                    "headers": [],
                    "rows": []
                }
            ]
        )

        router = DocumentGenerationRouter()
        # Should not raise error
        filepath, _ = router.generate(
            content=content,
            format=DocumentFormat.DOCX,
            output_path=os.path.join(output_dir, "empty_table.docx")
        )

        assert os.path.exists(filepath)
