"""
Document generation module.

Provides multi-format document generation capabilities:
- DOCX (Word documents)
- PPTX (PowerPoint presentations)
- XLSX (Excel spreadsheets)
- PDF (Portable Document Format)
- Markdown (plain text markup)
"""

from .base import DocumentGenerator, DocumentContent, DocumentMetadata

__all__ = [
    "DocumentGenerator",
    "DocumentContent",
    "DocumentMetadata",
]
