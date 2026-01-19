"""
Integration tests for document generation API.

Tests the REST API endpoints for document generation.
"""

import os
import pytest
from fastapi.testclient import TestClient
from datetime import datetime

from app.main import app


client = TestClient(app)


@pytest.fixture
def sample_request_data():
    """Sample request data for API testing."""
    return {
        "title": "API Test Document",
        "format": "docx",
        "sections": [
            {
                "heading": "Introduction",
                "type": "text",
                "content": "This document was generated via API."
            },
            {
                "heading": "Features",
                "type": "bullet_list",
                "items": [
                    "REST API endpoint",
                    "JSON request/response",
                    "Multiple format support"
                ]
            },
            {
                "heading": "Test Data",
                "type": "table",
                "headers": ["Column 1", "Column 2", "Column 3"],
                "rows": [
                    ["Data 1", "Data 2", "Data 3"],
                    ["Value 1", "Value 2", "Value 3"]
                ]
            }
        ],
        "metadata": {
            "author": "API Test Suite",
            "created_at": datetime.utcnow().isoformat()
        }
    }


class TestDocumentGenerationAPI:
    """Test document generation API endpoint."""

    def test_generate_docx_document(self, sample_request_data):
        """Test DOCX document generation via API."""
        response = client.post("/api/documents/generate", json=sample_request_data)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["format"] == "docx"
        assert os.path.exists(data["filepath"])
        assert data["file_size"] > 0
        assert "metadata" in data

        # Cleanup
        os.remove(data["filepath"])

    def test_generate_pptx_document(self, sample_request_data):
        """Test PPTX document generation via API."""
        sample_request_data["format"] = "pptx"

        response = client.post("/api/documents/generate", json=sample_request_data)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["format"] == "pptx"
        assert os.path.exists(data["filepath"])

        # Cleanup
        os.remove(data["filepath"])

    def test_generate_xlsx_document(self, sample_request_data):
        """Test XLSX document generation via API."""
        sample_request_data["format"] = "xlsx"

        response = client.post("/api/documents/generate", json=sample_request_data)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["format"] == "xlsx"
        assert os.path.exists(data["filepath"])

        # Cleanup
        os.remove(data["filepath"])

    def test_generate_pdf_document(self, sample_request_data):
        """Test PDF document generation via API."""
        sample_request_data["format"] = "pdf"

        response = client.post("/api/documents/generate", json=sample_request_data)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["format"] == "pdf"
        assert os.path.exists(data["filepath"])

        # Cleanup
        os.remove(data["filepath"])

    def test_generate_markdown_document(self, sample_request_data):
        """Test Markdown document generation via API."""
        sample_request_data["format"] = "markdown"

        response = client.post("/api/documents/generate", json=sample_request_data)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["format"] == "markdown"
        assert os.path.exists(data["filepath"])

        # Cleanup
        os.remove(data["filepath"])

    def test_invalid_format(self, sample_request_data):
        """Test error handling for invalid format."""
        sample_request_data["format"] = "invalid_format"

        response = client.post("/api/documents/generate", json=sample_request_data)

        assert response.status_code == 400
        assert "Unsupported format" in response.json()["detail"]

    def test_missing_title(self, sample_request_data):
        """Test error handling for missing title."""
        sample_request_data["title"] = ""

        response = client.post("/api/documents/generate", json=sample_request_data)

        assert response.status_code == 400

    def test_missing_sections(self, sample_request_data):
        """Test error handling for missing sections."""
        sample_request_data["sections"] = []

        response = client.post("/api/documents/generate", json=sample_request_data)

        assert response.status_code == 400

    def test_custom_output_path(self, sample_request_data, tmp_path):
        """Test custom output path."""
        output_path = str(tmp_path / "custom_output.docx")
        sample_request_data["output_path"] = output_path

        response = client.post("/api/documents/generate", json=sample_request_data)

        assert response.status_code == 200
        data = response.json()

        assert data["filepath"] == output_path
        assert os.path.exists(output_path)

        # Cleanup
        os.remove(output_path)


class TestSupportedFormatsAPI:
    """Test supported formats endpoint."""

    def test_get_supported_formats(self):
        """Test getting supported formats."""
        response = client.get("/api/documents/formats")

        assert response.status_code == 200
        data = response.json()

        assert "formats" in data
        assert "docx" in data["formats"]
        assert "pptx" in data["formats"]
        assert "xlsx" in data["formats"]
        assert "pdf" in data["formats"]
        assert "markdown" in data["formats"]


class TestDownloadAPI:
    """Test document download endpoint."""

    def test_download_document(self, sample_request_data):
        """Test downloading a generated document."""
        # First, generate a document
        response = client.post("/api/documents/generate", json=sample_request_data)
        assert response.status_code == 200
        filepath = response.json()["filepath"]
        filename = os.path.basename(filepath)

        # Now download it
        response = client.get(f"/api/documents/download/docx/{filename}")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        # Cleanup
        os.remove(filepath)

    def test_download_nonexistent_file(self):
        """Test downloading a file that doesn't exist."""
        response = client.get("/api/documents/download/docx/nonexistent.docx")

        assert response.status_code == 404

    def test_download_invalid_format(self):
        """Test downloading with invalid format."""
        response = client.get("/api/documents/download/invalid/test.docx")

        assert response.status_code == 400

    def test_download_path_traversal_protection(self):
        """Test protection against path traversal attacks."""
        response = client.get("/api/documents/download/docx/../../../etc/passwd")

        assert response.status_code in [403, 404]  # Access denied or not found


class TestCleanupAPI:
    """Test document cleanup endpoint."""

    def test_cleanup_documents(self, sample_request_data):
        """Test cleaning up generated documents."""
        # Generate some documents
        for _ in range(3):
            response = client.post("/api/documents/generate", json=sample_request_data)
            assert response.status_code == 200

        # Cleanup
        response = client.delete("/api/documents/cleanup")

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["deleted"] >= 3

    def test_cleanup_empty_directory(self):
        """Test cleanup when no documents exist."""
        # First, clean up any existing documents
        client.delete("/api/documents/cleanup")

        # Try cleanup again
        response = client.delete("/api/documents/cleanup")

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["deleted"] == 0


class TestComplexDocuments:
    """Test generation of complex documents."""

    def test_multi_section_document(self):
        """Test document with many sections."""
        request_data = {
            "title": "Complex Document",
            "format": "docx",
            "sections": [
                {"heading": f"Section {i}", "type": "text", "content": f"Content {i}"}
                for i in range(10)
            ]
        }

        response = client.post("/api/documents/generate", json=request_data)

        assert response.status_code == 200
        filepath = response.json()["filepath"]
        assert os.path.exists(filepath)

        # Cleanup
        os.remove(filepath)

    def test_large_table_document(self):
        """Test document with large table."""
        request_data = {
            "title": "Large Table Document",
            "format": "xlsx",
            "sections": [
                {
                    "heading": "Data",
                    "type": "table",
                    "headers": [f"Col{i}" for i in range(10)],
                    "rows": [[f"Data{i}_{j}" for j in range(10)] for i in range(100)]
                }
            ]
        }

        response = client.post("/api/documents/generate", json=request_data)

        assert response.status_code == 200
        filepath = response.json()["filepath"]
        assert os.path.exists(filepath)

        # Cleanup
        os.remove(filepath)

    def test_mixed_content_types(self):
        """Test document with all content types."""
        request_data = {
            "title": "Mixed Content Document",
            "format": "pdf",
            "sections": [
                {"heading": "Text", "type": "text", "content": "Sample text"},
                {"heading": "Bullets", "type": "bullet_list", "items": ["Item 1", "Item 2"]},
                {"heading": "Numbers", "type": "numbered_list", "items": ["Step 1", "Step 2"]},
                {"heading": "Table", "type": "table", "headers": ["A", "B"], "rows": [["1", "2"]]},
                {"heading": "Code", "type": "code", "content": "print('hello')", "language": "python"}
            ]
        }

        response = client.post("/api/documents/generate", json=request_data)

        assert response.status_code == 200
        filepath = response.json()["filepath"]
        assert os.path.exists(filepath)

        # Cleanup
        os.remove(filepath)
