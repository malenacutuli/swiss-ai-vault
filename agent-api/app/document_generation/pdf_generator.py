"""
PDF document generator using reportlab.

Generates PDF documents with:
- Title and heading styles
- Formatted paragraphs
- Tables with styling
- Page numbers
- Custom styles
"""

import os
from typing import Dict, Any, List
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfgen import canvas

from .base import DocumentGenerator, DocumentContent


class PDFGenerator(DocumentGenerator):
    """Generator for PDF documents."""

    def __init__(self, content: DocumentContent):
        """
        Initialize PDF generator.

        Args:
            content: DocumentContent with title and sections
        """
        super().__init__(content)
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        self.story = []

    def _setup_custom_styles(self):
        """Set up custom paragraph styles."""
        # Custom title style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#00008B'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))

        # Custom heading style
        self.styles.add(ParagraphStyle(
            name='CustomHeading',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#0070C0'),
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        ))

        # Custom body style
        self.styles.add(ParagraphStyle(
            name='CustomBody',
            parent=self.styles['Normal'],
            fontSize=11,
            spaceAfter=12,
            alignment=TA_JUSTIFY,
            fontName='Helvetica'
        ))

        # Code style (check if exists first)
        if 'CustomCode' not in [s.name for s in self.styles.byName.values() if hasattr(s, 'name')]:
            self.styles.add(ParagraphStyle(
                name='CustomCode',
                parent=self.styles['Normal'],
                fontSize=9,
                fontName='Courier',
                textColor=colors.HexColor('#333333'),
                backColor=colors.HexColor('#F5F5F5'),
                leftIndent=20,
                rightIndent=20,
                spaceAfter=12
            ))

    def get_format_name(self) -> str:
        """Return format name."""
        return "pdf"

    def validate_content(self) -> bool:
        """
        Validate content structure for PDF generation.

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
        Generate PDF document.

        Args:
            output_path: Path to save the document

        Returns:
            str: Path to generated document
        """
        self.validate_content()

        # Create document
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18
        )

        # Build story (content)
        self._build_story()

        # Build PDF
        doc.build(self.story, onFirstPage=self._add_page_number, onLaterPages=self._add_page_number)

        # Update metadata
        file_size = os.path.getsize(output_path)
        self.update_metadata(file_size=file_size)

        return output_path

    def _build_story(self):
        """Build the document story (content flow)."""
        # Add title
        title = Paragraph(self.content.title, self.styles['CustomTitle'])
        self.story.append(title)

        # Add metadata if present
        if self.content.metadata:
            author = self.content.metadata.get("author", "Swiss AI Vault Agent")
            created_at = self.content.metadata.get("created_at", "")
            meta_text = f"<i>By {author} | {created_at}</i>"
            meta_para = Paragraph(meta_text, self.styles['Normal'])
            self.story.append(meta_para)

        self.story.append(Spacer(1, 0.5 * inch))

        # Add sections
        for section in self.content.sections:
            self._add_section(section)

    def _add_section(self, section: Dict[str, Any]):
        """
        Add a section to the story.

        Args:
            section: Section data
        """
        # Add section heading
        heading = section.get("heading", "Section")
        heading_para = Paragraph(heading, self.styles['CustomHeading'])
        self.story.append(heading_para)

        # Add content based on type
        content_type = section.get("type", "text")

        if content_type == "text":
            self._add_text_content(section)

        elif content_type in ["bullet_list", "numbered_list"]:
            self._add_list_content(section)

        elif content_type == "table":
            self._add_table_content(section)

        elif content_type == "code":
            self._add_code_content(section)

        # Add spacing after section
        self.story.append(Spacer(1, 0.2 * inch))

    def _add_text_content(self, section: Dict[str, Any]):
        """Add text content to story."""
        content = section.get("content", "")

        if isinstance(content, list):
            for item in content:
                para = Paragraph(str(item), self.styles['CustomBody'])
                self.story.append(para)
        else:
            para = Paragraph(str(content), self.styles['CustomBody'])
            self.story.append(para)

    def _add_list_content(self, section: Dict[str, Any]):
        """Add list content to story."""
        items = section.get("items", [])
        content_type = section.get("type", "bullet_list")

        for idx, item in enumerate(items, start=1):
            if content_type == "numbered_list":
                text = f"{idx}. {item}"
            else:
                text = f"• {item}"

            para = Paragraph(text, self.styles['CustomBody'])
            self.story.append(para)

    def _add_table_content(self, section: Dict[str, Any]):
        """Add table to story."""
        headers = section.get("headers", [])
        rows = section.get("rows", [])

        if not headers or not rows:
            return

        # Build table data
        table_data = [headers] + rows

        # Create table
        table = Table(table_data, repeatRows=1)

        # Style table
        table.setStyle(TableStyle([
            # Header styling
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0070C0')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),

            # Data rows styling
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),

            # Grid
            ('GRID', (0, 0), (-1, -1), 1, colors.black),

            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F2F2F2')])
        ]))

        self.story.append(table)
        self.story.append(Spacer(1, 0.2 * inch))

    def _add_code_content(self, section: Dict[str, Any]):
        """Add code content to story."""
        code = section.get("content", "")

        # Escape special characters for reportlab
        code_escaped = code.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

        para = Paragraph(f"<font name='Courier'>{code_escaped}</font>", self.styles['CustomCode'])
        self.story.append(para)

    def _add_page_number(self, canvas_obj, doc):
        """
        Add page numbers to the document.

        Args:
            canvas_obj: ReportLab canvas
            doc: Document template
        """
        page_num = canvas_obj.getPageNumber()
        text = f"Page {page_num}"
        canvas_obj.saveState()
        canvas_obj.setFont('Helvetica', 9)
        canvas_obj.drawRightString(7.5 * inch, 0.5 * inch, text)
        canvas_obj.restoreState()
