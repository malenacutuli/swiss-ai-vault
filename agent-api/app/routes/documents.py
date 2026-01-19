"""
Document generation API endpoint.

Provides REST API for generating documents in multiple formats:
- DOCX, PPTX, XLSX, PDF, Markdown
"""

from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import os
import structlog

from app.document_generation.router import DocumentGenerationRouter, DocumentFormat
from app.document_generation.base import DocumentContent

logger = structlog.get_logger()

router = APIRouter(prefix="/api/documents", tags=["documents"])


class DocumentGenerationRequest(BaseModel):
    """Request model for document generation."""
    title: str = Field(..., description="Document title")
    format: str = Field(..., description="Output format (docx, pptx, xlsx, pdf, markdown)")
    sections: list[Dict[str, Any]] = Field(..., description="Document sections")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Optional metadata")
    output_path: Optional[str] = Field(None, description="Optional custom output path")


class DocumentGenerationResponse(BaseModel):
    """Response model for document generation."""
    success: bool
    format: str
    filepath: str
    file_size: int
    metadata: Dict[str, Any]
    message: Optional[str] = None


class SupportedFormatsResponse(BaseModel):
    """Response model for supported formats."""
    formats: list[str]


@router.post("/generate", response_model=DocumentGenerationResponse)
async def generate_document(request: DocumentGenerationRequest):
    """
    Generate a document in the specified format.

    Args:
        request: Document generation request

    Returns:
        DocumentGenerationResponse with file path and metadata

    Raises:
        HTTPException: If generation fails
    """
    logger.info(
        "document_generation_requested",
        title=request.title,
        format=request.format,
        num_sections=len(request.sections)
    )

    try:
        # Validate format
        router_instance = DocumentGenerationRouter()
        if not router_instance.validate_format(request.format):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported format: {request.format}. Supported formats: {router_instance.get_supported_formats()}"
            )

        # Build content
        content = DocumentContent(
            title=request.title,
            sections=request.sections,
            metadata=request.metadata
        )

        # Generate document
        format_enum = DocumentFormat(request.format.lower())
        filepath, metadata = router_instance.generate(
            content=content,
            format=format_enum,
            output_path=request.output_path
        )

        logger.info(
            "document_generated_successfully",
            filepath=filepath,
            format=request.format,
            file_size=metadata.file_size
        )

        return DocumentGenerationResponse(
            success=True,
            format=request.format,
            filepath=filepath,
            file_size=metadata.file_size or 0,
            metadata=metadata.dict(),
            message=f"Document generated successfully: {filepath}"
        )

    except ValueError as e:
        logger.error("document_generation_validation_error", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error("document_generation_failed", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Document generation failed: {str(e)}")


@router.get("/download/{format}/{filename}")
async def download_document(format: str, filename: str):
    """
    Download a generated document.

    Args:
        format: Document format
        filename: Filename to download

    Returns:
        FileResponse with the document

    Raises:
        HTTPException: If file not found
    """
    # Security: Validate format and sanitize filename
    router_instance = DocumentGenerationRouter()
    if not router_instance.validate_format(format):
        raise HTTPException(status_code=400, detail=f"Invalid format: {format}")

    # Construct file path (from /tmp/documents directory)
    base_dir = "/tmp/documents"
    filepath = os.path.join(base_dir, filename)

    # Security: Ensure path is within base directory (prevent path traversal)
    real_path = os.path.realpath(filepath)
    if not real_path.startswith(os.path.realpath(base_dir)):
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if file exists
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Document not found")

    # Determine media type
    media_types = {
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pdf": "application/pdf",
        "markdown": "text/markdown"
    }
    media_type = media_types.get(format.lower(), "application/octet-stream")

    logger.info("document_download", filepath=filepath, format=format)

    return FileResponse(
        path=filepath,
        media_type=media_type,
        filename=filename
    )


@router.get("/formats", response_model=SupportedFormatsResponse)
async def get_supported_formats():
    """
    Get list of supported document formats.

    Returns:
        SupportedFormatsResponse with list of formats
    """
    router_instance = DocumentGenerationRouter()
    formats = router_instance.get_supported_formats()

    return SupportedFormatsResponse(formats=formats)


@router.delete("/cleanup")
async def cleanup_documents():
    """
    Clean up all generated documents in /tmp/documents.

    Returns:
        dict with cleanup status

    Note: This is a utility endpoint for cleaning up temporary files.
    In production, consider implementing automatic cleanup based on file age.
    """
    base_dir = "/tmp/documents"

    if not os.path.exists(base_dir):
        return {"success": True, "message": "No documents to clean up", "deleted": 0}

    deleted_count = 0
    try:
        for filename in os.listdir(base_dir):
            filepath = os.path.join(base_dir, filename)
            if os.path.isfile(filepath):
                os.remove(filepath)
                deleted_count += 1

        logger.info("documents_cleaned_up", deleted_count=deleted_count)

        return {
            "success": True,
            "message": f"Cleaned up {deleted_count} documents",
            "deleted": deleted_count
        }

    except Exception as e:
        logger.error("document_cleanup_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")
