"""
Manual test script for document generation.
Run this to verify all generators work correctly.
"""

import os
import sys
from datetime import datetime

# Add app to path
sys.path.insert(0, '/Users/malena/swiss-ai-vault/agent-api')

from app.document_generation.base import DocumentContent
from app.document_generation.router import DocumentGenerationRouter, DocumentFormat


def test_all_formats():
    """Test all document formats."""

    # Create sample content
    content = DocumentContent(
        title="Test Document - Phase 4",
        sections=[
            {
                "heading": "Introduction",
                "type": "text",
                "content": "This is a test document generated for Phase 4 verification."
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
                "headers": ["Format", "Extension", "Status"],
                "rows": [
                    ["Word", ".docx", "Implemented"],
                    ["PowerPoint", ".pptx", "Implemented"],
                    ["Excel", ".xlsx", "Implemented"],
                    ["PDF", ".pdf", "Implemented"],
                    ["Markdown", ".md", "Implemented"]
                ]
            },
            {
                "heading": "Code Example",
                "type": "code",
                "language": "python",
                "content": """def generate_document(format: str):
    router = DocumentGenerationRouter()
    return router.generate(content, format)"""
            }
        ],
        metadata={
            "author": "Swiss AI Vault Agent",
            "created_at": datetime.utcnow().isoformat()
        }
    )

    # Create router
    router = DocumentGenerationRouter()

    # Test directory
    test_dir = "/tmp/phase4_test"
    os.makedirs(test_dir, exist_ok=True)

    print("Testing Phase 4 Document Generation")
    print("=" * 50)

    # Test all formats
    formats = [
        (DocumentFormat.DOCX, "test.docx"),
        (DocumentFormat.PPTX, "test.pptx"),
        (DocumentFormat.XLSX, "test.xlsx"),
        (DocumentFormat.PDF, "test.pdf"),
        (DocumentFormat.MARKDOWN, "test.md")
    ]

    results = []

    for format_type, filename in formats:
        try:
            output_path = os.path.join(test_dir, filename)
            filepath, metadata = router.generate(
                content=content,
                format=format_type,
                output_path=output_path
            )

            file_size = os.path.getsize(filepath)

            print(f"✓ {format_type.value.upper():10} - Generated: {filepath}")
            print(f"  File size: {file_size:,} bytes")

            results.append({
                "format": format_type.value,
                "success": True,
                "filepath": filepath,
                "size": file_size
            })

        except Exception as e:
            print(f"✗ {format_type.value.upper():10} - Failed: {str(e)}")
            results.append({
                "format": format_type.value,
                "success": False,
                "error": str(e)
            })

    print("\n" + "=" * 50)
    print("Summary:")
    print(f"Total formats tested: {len(results)}")
    print(f"Successful: {sum(1 for r in results if r['success'])}")
    print(f"Failed: {sum(1 for r in results if not r['success'])}")

    print("\nGenerated files:")
    for r in results:
        if r['success']:
            print(f"  - {r['filepath']} ({r['size']:,} bytes)")

    return all(r['success'] for r in results)


if __name__ == "__main__":
    try:
        success = test_all_formats()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
