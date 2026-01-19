# Manus Document Generation Infrastructure

**Document Version:** 1.0  
**Author:** Manus AI  
**Date:** January 12, 2026  
**Classification:** Technical Architecture Documentation

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Slides/PPTX Generation](#2-slidespptx-generation)
3. [Excel/XLS Generation](#3-excelxls-generation)
4. [Image Generation](#4-image-generation)
5. [Word/DOCX Generation](#5-worddocx-generation)
6. [Infographics Generation](#6-infographics-generation)
7. [Website Generation](#7-website-generation)
8. [PDF Generation](#8-pdf-generation)
9. [Unified Document Pipeline](#9-unified-document-pipeline)

---

## 1. Architecture Overview

### 1.1 Document Generation Philosophy

Manus employs a **multi-modal document generation pipeline** that combines AI-powered content creation with specialized rendering engines for each output format. The architecture follows a separation of concerns principle:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                                         │
│                    "Create a presentation about X"                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CONTENT GENERATION LAYER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Research  │  │   Outline   │  │    Text     │  │   Assets    │        │
│  │   & Data    │  │  Structure  │  │  Generation │  │  Collection │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FORMAT-SPECIFIC RENDERING                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  PPTX   │ │  XLSX   │ │  IMAGE  │ │  DOCX   │ │   PDF   │ │   WEB   │  │
│  │ Engine  │ │ Engine  │ │ Engine  │ │ Engine  │ │ Engine  │ │ Engine  │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OUTPUT DELIVERY                                      │
│              File attachment, Preview URL, or Embedded viewer                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Available Tools and Libraries

Based on my sandbox environment, here are the systems available for document generation:

| Document Type | Primary Tool | Library/System | Output Format |
|---------------|--------------|----------------|---------------|
| **Slides** | `slides` tool | Manus Slides Engine | HTML/CSS or Image-based |
| **Excel** | Python | `openpyxl`, `pandas` | .xlsx |
| **Images** | `generate` tool | AI Image Generation API | PNG, JPG, WebP |
| **Word** | Python | `python-docx`, Markdown | .docx |
| **PDF** | CLI utility | `manus-md-to-pdf`, `weasyprint`, `fpdf2` | .pdf |
| **Infographics** | Hybrid | AI Images + Diagrams | PNG, SVG |
| **Websites** | `webdev_*` tools | React, Vite, Tailwind | HTML/CSS/JS |
| **Diagrams** | CLI utility | `manus-render-diagram` | PNG from .mmd/.d2/.puml |

### 1.3 Pre-installed Python Packages

```python
# Document generation packages available in sandbox
DOCUMENT_PACKAGES = {
    'openpyxl': 'Excel file creation and manipulation',
    'pandas': 'Data manipulation and Excel export',
    'python-docx': 'Word document generation (via pip)',
    'fpdf2': 'PDF generation from scratch',
    'weasyprint': 'HTML to PDF conversion',
    'reportlab': 'Advanced PDF generation',
    'pillow': 'Image manipulation',
    'matplotlib': 'Charts and visualizations',
    'plotly': 'Interactive charts',
    'seaborn': 'Statistical visualizations',
    'markdown': 'Markdown parsing',
}
```

---

## 2. Slides/PPTX Generation

### 2.1 System Architecture

Manus uses a dedicated **slides mode** with two rendering approaches:

| Mode | Description | Use Case | Editability |
|------|-------------|----------|-------------|
| **HTML Mode** | Traditional HTML/CSS with Chart.js | Data-heavy presentations | User-editable |
| **Image Mode** | Each slide rendered as image | Visually stunning designs | Not editable |

### 2.2 Slides Generation Pipeline

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Content Prep   │────▶│  Slide Content  │────▶│  Slides Mode    │
│  (Research,     │     │  Markdown File  │     │  Rendering      │
│   Outline)      │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                              ┌──────────────────────────┤
                              │                          │
                              ▼                          ▼
                    ┌─────────────────┐        ┌─────────────────┐
                    │   HTML Mode     │        │   Image Mode    │
                    │  (Chart.js,     │        │  (AI-rendered   │
                    │   editable)     │        │   slides)       │
                    └─────────────────┘        └─────────────────┘
                              │                          │
                              ▼                          ▼
                    ┌─────────────────┐        ┌─────────────────┐
                    │  Export: PPTX   │        │  Export: PPTX   │
                    │  via CLI tool   │        │  via CLI tool   │
                    └─────────────────┘        └─────────────────┘
```

### 2.3 Pseudocode: Slides Generation

```python
# Phase 1: Content Preparation (MUST be separate from rendering)
async def prepare_slide_content(user_request: str) -> SlideContent:
    """
    Content preparation phase - research, outline, asset collection.
    This MUST happen BEFORE entering slides mode.
    """
    # Step 1: Research the topic
    research_results = await search(
        type="info",
        queries=[user_request, f"{user_request} statistics", f"{user_request} trends"]
    )
    
    # Step 2: Generate outline with LLM
    outline = await invoke_llm(
        messages=[
            {"role": "system", "content": "Create a presentation outline with 8-12 slides"},
            {"role": "user", "content": f"Topic: {user_request}\nResearch: {research_results}"}
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "slide_outline",
                "schema": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "slides": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "title": {"type": "string"},
                                    "content": {"type": "string"},
                                    "visual_suggestion": {"type": "string"},
                                    "data_chart": {"type": "object"}
                                }
                            }
                        }
                    }
                }
            }
        }
    )
    
    # Step 3: Collect/generate images if needed
    images = []
    for slide in outline.slides:
        if slide.needs_image:
            image = await generate_image(prompt=slide.visual_suggestion)
            images.append(image)
    
    # Step 4: Write slide content markdown file
    markdown_content = format_slides_markdown(outline, images)
    await file_write("/home/ubuntu/project/slide_content.md", markdown_content)
    
    return SlideContent(
        file_path="/home/ubuntu/project/slide_content.md",
        slide_count=len(outline.slides),
        mode="html"  # or "image" for artistic slides
    )


# Phase 2: Slides Rendering (separate phase)
async def render_slides(content: SlideContent) -> SlidesResult:
    """
    Enter slides mode and render the presentation.
    """
    result = await slides(
        brief="Generate presentation from prepared content",
        slide_content_file_path=content.file_path,
        slide_count=content.slide_count,
        generate_mode=content.mode  # "html" or "image"
    )
    
    return result  # Returns manus-slides://{version_id}


# Phase 3: Export to PPTX (optional)
async def export_to_pptx(slides_uri: str) -> str:
    """
    Export slides to PowerPoint format using CLI utility.
    """
    output_path = "/home/ubuntu/project/presentation.pptx"
    
    # manus-export-slides converts to PPTX or PDF
    await shell_exec(
        f"manus-export-slides {slides_uri} ppt",
        timeout=60
    )
    
    return output_path
```

### 2.4 Slide Content Markdown Format

```markdown
# Presentation Title

## Slide 1: Introduction
- Key point 1
- Key point 2
- Key point 3

Speaker notes: This slide introduces the topic...

## Slide 2: Market Overview
[Chart: bar chart showing market growth]
Data:
- 2022: $10B
- 2023: $15B
- 2024: $22B

## Slide 3: Key Statistics
![infographic](/path/to/generated/image.png)

## Slide 4: Conclusion
- Summary point 1
- Summary point 2
- Call to action
```

---

## 3. Excel/XLS Generation

### 3.1 System Architecture

Excel generation uses Python's `openpyxl` library for full-featured spreadsheet creation, or `pandas` for data-centric exports.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Data Source    │────▶│  Data Transform │────▶│  Excel Engine   │
│  (API, DB,      │     │  (pandas,       │     │  (openpyxl)     │
│   user input)   │     │   calculations) │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Styling &      │
                                              │  Formatting     │
                                              │  (charts, etc.) │
                                              └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  .xlsx Output   │
                                              └─────────────────┘
```

### 3.2 Pseudocode: Excel Generation

```python
import openpyxl
from openpyxl.styles import Font, Fill, Alignment, Border, PatternFill
from openpyxl.chart import BarChart, LineChart, PieChart, Reference
from openpyxl.utils.dataframe import dataframe_to_rows
import pandas as pd

async def generate_excel_report(
    data: dict,
    template: str = None,
    output_path: str = "/home/ubuntu/output/report.xlsx"
) -> str:
    """
    Generate a formatted Excel workbook with multiple sheets, charts, and styling.
    """
    
    # Create workbook
    wb = openpyxl.Workbook()
    
    # ============================================
    # SHEET 1: Summary Dashboard
    # ============================================
    ws_summary = wb.active
    ws_summary.title = "Summary"
    
    # Add title with styling
    ws_summary['A1'] = "Financial Report Q4 2025"
    ws_summary['A1'].font = Font(size=18, bold=True, color="1F4E79")
    ws_summary.merge_cells('A1:F1')
    
    # Add KPI cards
    kpis = [
        ("Total Revenue", "$1,234,567", "+12.5%"),
        ("Net Profit", "$234,567", "+8.3%"),
        ("Customers", "45,678", "+15.2%"),
        ("Churn Rate", "2.3%", "-0.5%"),
    ]
    
    for idx, (label, value, change) in enumerate(kpis):
        col = idx * 2 + 1
        ws_summary.cell(row=3, column=col, value=label).font = Font(bold=True)
        ws_summary.cell(row=4, column=col, value=value).font = Font(size=14)
        change_cell = ws_summary.cell(row=5, column=col, value=change)
        change_cell.font = Font(
            color="00AA00" if change.startswith("+") else "AA0000"
        )
    
    # ============================================
    # SHEET 2: Data Table
    # ============================================
    ws_data = wb.create_sheet("Data")
    
    # Convert pandas DataFrame to Excel
    df = pd.DataFrame(data['transactions'])
    
    for r_idx, row in enumerate(dataframe_to_rows(df, index=False, header=True), 1):
        for c_idx, value in enumerate(row, 1):
            cell = ws_data.cell(row=r_idx, column=c_idx, value=value)
            
            # Style header row
            if r_idx == 1:
                cell.font = Font(bold=True, color="FFFFFF")
                cell.fill = PatternFill(start_color="1F4E79", fill_type="solid")
                cell.alignment = Alignment(horizontal="center")
            
            # Alternate row colors
            elif r_idx % 2 == 0:
                cell.fill = PatternFill(start_color="F2F2F2", fill_type="solid")
    
    # Auto-adjust column widths
    for column in ws_data.columns:
        max_length = max(len(str(cell.value or "")) for cell in column)
        ws_data.column_dimensions[column[0].column_letter].width = max_length + 2
    
    # Add filters
    ws_data.auto_filter.ref = ws_data.dimensions
    
    # ============================================
    # SHEET 3: Charts
    # ============================================
    ws_charts = wb.create_sheet("Charts")
    
    # Prepare chart data
    chart_data = [
        ["Month", "Revenue", "Expenses", "Profit"],
        ["Jan", 100000, 80000, 20000],
        ["Feb", 120000, 85000, 35000],
        ["Mar", 115000, 82000, 33000],
        ["Apr", 130000, 90000, 40000],
        ["May", 145000, 95000, 50000],
        ["Jun", 160000, 100000, 60000],
    ]
    
    for row in chart_data:
        ws_charts.append(row)
    
    # Create bar chart
    bar_chart = BarChart()
    bar_chart.type = "col"
    bar_chart.grouping = "clustered"
    bar_chart.title = "Monthly Financial Performance"
    bar_chart.y_axis.title = "Amount ($)"
    bar_chart.x_axis.title = "Month"
    
    data_ref = Reference(ws_charts, min_col=2, min_row=1, max_col=4, max_row=7)
    cats_ref = Reference(ws_charts, min_col=1, min_row=2, max_row=7)
    
    bar_chart.add_data(data_ref, titles_from_data=True)
    bar_chart.set_categories(cats_ref)
    bar_chart.shape = 4  # Rounded corners
    
    ws_charts.add_chart(bar_chart, "A10")
    
    # Create line chart for trends
    line_chart = LineChart()
    line_chart.title = "Revenue Trend"
    line_chart.y_axis.title = "Revenue ($)"
    line_chart.x_axis.title = "Month"
    
    revenue_ref = Reference(ws_charts, min_col=2, min_row=1, max_row=7)
    line_chart.add_data(revenue_ref, titles_from_data=True)
    line_chart.set_categories(cats_ref)
    
    ws_charts.add_chart(line_chart, "J10")
    
    # ============================================
    # SHEET 4: Pivot-style Analysis
    # ============================================
    ws_analysis = wb.create_sheet("Analysis")
    
    # Create pivot table manually (openpyxl doesn't support true pivots)
    pivot_data = df.groupby(['category', 'region']).agg({
        'amount': 'sum',
        'quantity': 'sum'
    }).reset_index()
    
    for r_idx, row in enumerate(dataframe_to_rows(pivot_data, index=False, header=True), 1):
        for c_idx, value in enumerate(row, 1):
            ws_analysis.cell(row=r_idx, column=c_idx, value=value)
    
    # ============================================
    # FORMULAS AND CALCULATIONS
    # ============================================
    ws_summary['A10'] = "Calculated Metrics"
    ws_summary['A11'] = "Total:"
    ws_summary['B11'] = f"=SUM(Data!C2:C{len(df)+1})"  # Sum formula
    ws_summary['A12'] = "Average:"
    ws_summary['B12'] = f"=AVERAGE(Data!C2:C{len(df)+1})"
    ws_summary['A13'] = "Max:"
    ws_summary['B13'] = f"=MAX(Data!C2:C{len(df)+1})"
    
    # ============================================
    # SAVE WORKBOOK
    # ============================================
    wb.save(output_path)
    
    return output_path


# Alternative: Quick pandas export
async def quick_excel_export(df: pd.DataFrame, output_path: str) -> str:
    """
    Quick export using pandas ExcelWriter with formatting.
    """
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Data', index=False)
        
        # Access workbook for styling
        workbook = writer.book
        worksheet = writer.sheets['Data']
        
        # Apply formatting
        for cell in worksheet[1]:
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="4472C4", fill_type="solid")
            cell.font = Font(color="FFFFFF", bold=True)
    
    return output_path
```

---

## 4. Image Generation

### 4.1 System Architecture

Manus uses an AI-powered image generation system accessed through the `generate` tool mode.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Text Prompt    │────▶│  Generate Mode  │────▶│  AI Image API   │
│  (description,  │     │  Tool Entry     │     │  (internal      │
│   style hints)  │     │                 │     │   service)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Image Output   │
                                              │  (PNG, JPG,     │
                                              │   WebP)         │
                                              └─────────────────┘
```

### 4.2 Image Generation Capabilities

| Capability | Description | Example Use Case |
|------------|-------------|------------------|
| **Text-to-Image** | Generate images from text descriptions | Marketing visuals, illustrations |
| **Image Editing** | Modify existing images with prompts | Background removal, style transfer |
| **Diagrams** | Render technical diagrams | Architecture diagrams, flowcharts |

### 4.3 Pseudocode: Image Generation

```python
# Method 1: AI Image Generation (via generate tool)
async def generate_ai_image(
    prompt: str,
    style: str = "photorealistic",
    size: str = "1024x1024"
) -> str:
    """
    Generate an image using AI image generation.
    Requires entering 'generate' mode first.
    """
    
    # Enter generate mode
    await generate(brief=f"Generate image: {prompt}")
    
    # Within generate mode, use image generation tools
    # The actual generation happens through internal APIs
    
    # Example prompt engineering
    enhanced_prompt = f"""
    {prompt}
    
    Style: {style}
    Quality: high detail, professional
    Lighting: studio lighting
    """
    
    # Returns path to generated image
    return "/home/ubuntu/generated/image.png"


# Method 2: Diagram Generation (via CLI utility)
async def generate_diagram(
    diagram_type: str,
    content: str,
    output_path: str
) -> str:
    """
    Generate technical diagrams using manus-render-diagram utility.
    Supports: Mermaid (.mmd), D2 (.d2), PlantUML (.puml)
    """
    
    # Determine file extension
    extensions = {
        "mermaid": ".mmd",
        "d2": ".d2",
        "plantuml": ".puml"
    }
    ext = extensions.get(diagram_type, ".mmd")
    
    # Write diagram source
    input_path = f"/home/ubuntu/temp/diagram{ext}"
    await file_write(input_path, content)
    
    # Render to PNG
    await shell_exec(
        f"manus-render-diagram {input_path} {output_path}",
        timeout=30
    )
    
    return output_path


# Example: Mermaid diagram content
MERMAID_FLOWCHART = """
flowchart TD
    A[User Request] --> B{Document Type?}
    B -->|PPTX| C[Slides Engine]
    B -->|XLSX| D[Excel Engine]
    B -->|Image| E[AI Generation]
    B -->|DOCX| F[Word Engine]
    C --> G[Output File]
    D --> G
    E --> G
    F --> G
"""

# Example: D2 diagram content
D2_ARCHITECTURE = """
direction: right

user: User {
  shape: person
}

api: API Gateway {
  shape: cloud
}

services: Services {
  auth: Authentication
  docs: Document Generator
  storage: File Storage
}

user -> api -> services.auth
api -> services.docs
services.docs -> services.storage
"""


# Method 3: Chart/Visualization Generation (matplotlib/plotly)
async def generate_chart(
    chart_type: str,
    data: dict,
    output_path: str,
    style: str = "modern"
) -> str:
    """
    Generate charts and visualizations using matplotlib or plotly.
    """
    import matplotlib.pyplot as plt
    import seaborn as sns
    
    # Set style
    if style == "modern":
        plt.style.use('seaborn-v0_8-whitegrid')
        sns.set_palette("husl")
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    if chart_type == "bar":
        ax.bar(data['labels'], data['values'], color=sns.color_palette())
    elif chart_type == "line":
        ax.plot(data['labels'], data['values'], marker='o', linewidth=2)
    elif chart_type == "pie":
        ax.pie(data['values'], labels=data['labels'], autopct='%1.1f%%')
    
    ax.set_title(data.get('title', 'Chart'), fontsize=14, fontweight='bold')
    ax.set_xlabel(data.get('xlabel', ''))
    ax.set_ylabel(data.get('ylabel', ''))
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    return output_path
```

---

## 5. Word/DOCX Generation

### 5.1 System Architecture

Word document generation uses `python-docx` for full-featured DOCX creation, or Markdown-to-DOCX conversion via `pandoc`.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Content        │────▶│  Document       │────▶│  python-docx    │
│  (text, images, │     │  Structure      │     │  Engine         │
│   tables)       │     │  Definition     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Styling &      │
                                              │  Formatting     │
                                              └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  .docx Output   │
                                              └─────────────────┘
```

### 5.2 Pseudocode: Word Document Generation

```python
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

async def generate_word_document(
    content: DocumentContent,
    template_path: str = None,
    output_path: str = "/home/ubuntu/output/document.docx"
) -> str:
    """
    Generate a professionally formatted Word document.
    """
    
    # Create document (or load template)
    if template_path:
        doc = Document(template_path)
    else:
        doc = Document()
    
    # ============================================
    # DOCUMENT SETUP
    # ============================================
    
    # Set default font
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(11)
    
    # Create custom styles
    heading_style = doc.styles.add_style('CustomHeading', WD_STYLE_TYPE.PARAGRAPH)
    heading_style.font.size = Pt(16)
    heading_style.font.bold = True
    heading_style.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)
    
    # ============================================
    # COVER PAGE
    # ============================================
    
    # Add title
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run(content.title)
    run.font.size = Pt(28)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)
    
    # Add subtitle
    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run(content.subtitle)
    run.font.size = Pt(14)
    run.font.italic = True
    
    # Add date
    date_para = doc.add_paragraph()
    date_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    date_para.add_run(content.date)
    
    # Page break after cover
    doc.add_page_break()
    
    # ============================================
    # TABLE OF CONTENTS
    # ============================================
    
    doc.add_heading('Table of Contents', level=1)
    
    # Add TOC field (updates when opened in Word)
    paragraph = doc.add_paragraph()
    run = paragraph.add_run()
    fldChar1 = OxmlElement('w:fldChar')
    fldChar1.set(qn('w:fldCharType'), 'begin')
    
    instrText = OxmlElement('w:instrText')
    instrText.set(qn('xml:space'), 'preserve')
    instrText.text = 'TOC \\o "1-3" \\h \\z \\u'
    
    fldChar2 = OxmlElement('w:fldChar')
    fldChar2.set(qn('w:fldCharType'), 'separate')
    
    fldChar3 = OxmlElement('w:fldChar')
    fldChar3.set(qn('w:fldCharType'), 'end')
    
    run._r.append(fldChar1)
    run._r.append(instrText)
    run._r.append(fldChar2)
    run._r.append(fldChar3)
    
    doc.add_page_break()
    
    # ============================================
    # CONTENT SECTIONS
    # ============================================
    
    for section in content.sections:
        # Add heading
        doc.add_heading(section.title, level=section.level)
        
        # Add paragraphs
        for para_text in section.paragraphs:
            para = doc.add_paragraph(para_text)
            para.paragraph_format.space_after = Pt(12)
            para.paragraph_format.line_spacing = 1.5
        
        # Add images if present
        if section.images:
            for image in section.images:
                doc.add_picture(image.path, width=Inches(5))
                caption = doc.add_paragraph(image.caption)
                caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
                caption.runs[0].font.italic = True
                caption.runs[0].font.size = Pt(10)
        
        # Add tables if present
        if section.tables:
            for table_data in section.tables:
                table = doc.add_table(
                    rows=len(table_data.rows) + 1,
                    cols=len(table_data.headers)
                )
                table.style = 'Table Grid'
                table.alignment = WD_TABLE_ALIGNMENT.CENTER
                
                # Header row
                header_row = table.rows[0]
                for idx, header in enumerate(table_data.headers):
                    cell = header_row.cells[idx]
                    cell.text = header
                    cell.paragraphs[0].runs[0].font.bold = True
                    # Set background color
                    shading = OxmlElement('w:shd')
                    shading.set(qn('w:fill'), '1F4E79')
                    cell._tc.get_or_add_tcPr().append(shading)
                    cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
                
                # Data rows
                for row_idx, row_data in enumerate(table_data.rows):
                    row = table.rows[row_idx + 1]
                    for col_idx, cell_value in enumerate(row_data):
                        row.cells[col_idx].text = str(cell_value)
        
        # Add bullet lists if present
        if section.bullet_points:
            for point in section.bullet_points:
                para = doc.add_paragraph(point, style='List Bullet')
    
    # ============================================
    # FOOTER WITH PAGE NUMBERS
    # ============================================
    
    section = doc.sections[0]
    footer = section.footer
    footer_para = footer.paragraphs[0]
    footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Add page number field
    run = footer_para.add_run()
    fldChar1 = OxmlElement('w:fldChar')
    fldChar1.set(qn('w:fldCharType'), 'begin')
    instrText = OxmlElement('w:instrText')
    instrText.text = "PAGE"
    fldChar2 = OxmlElement('w:fldChar')
    fldChar2.set(qn('w:fldCharType'), 'end')
    run._r.append(fldChar1)
    run._r.append(instrText)
    run._r.append(fldChar2)
    
    # ============================================
    # SAVE DOCUMENT
    # ============================================
    
    doc.save(output_path)
    return output_path


# Alternative: Markdown to DOCX conversion
async def markdown_to_docx(
    markdown_path: str,
    output_path: str
) -> str:
    """
    Convert Markdown file to DOCX using pandoc.
    """
    await shell_exec(
        f"pandoc {markdown_path} -o {output_path} --reference-doc=template.docx",
        timeout=30
    )
    return output_path
```

---

## 6. Infographics Generation

### 6.1 System Architecture

Infographics combine AI image generation with data visualization and text overlays.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Data & Content │────▶│  Layout Design  │────▶│  Component      │
│  Extraction     │     │  (template or   │     │  Generation     │
│                 │     │   AI-generated) │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                              ┌──────────────────────────┤
                              │                          │
                              ▼                          ▼
                    ┌─────────────────┐        ┌─────────────────┐
                    │  Charts/Icons   │        │  AI Background  │
                    │  (matplotlib,   │        │  Generation     │
                    │   SVG)          │        │                 │
                    └─────────────────┘        └─────────────────┘
                              │                          │
                              └──────────┬───────────────┘
                                         ▼
                              ┌─────────────────┐
                              │  Composite      │
                              │  (Pillow)       │
                              └─────────────────┘
                                         │
                                         ▼
                              ┌─────────────────┐
                              │  PNG/SVG Output │
                              └─────────────────┘
```

### 6.2 Pseudocode: Infographic Generation

```python
from PIL import Image, ImageDraw, ImageFont
import matplotlib.pyplot as plt
from io import BytesIO

async def generate_infographic(
    data: InfographicData,
    style: str = "modern",
    output_path: str = "/home/ubuntu/output/infographic.png"
) -> str:
    """
    Generate a data-driven infographic combining multiple visual elements.
    """
    
    # ============================================
    # STEP 1: CREATE BASE CANVAS
    # ============================================
    
    # Infographic dimensions (tall format typical for infographics)
    width, height = 1200, 2400
    
    # Create base image with background
    if style == "modern":
        # Gradient background
        base = create_gradient_background(width, height, 
            start_color=(30, 60, 114),  # Dark blue
            end_color=(42, 82, 152)     # Lighter blue
        )
    else:
        base = Image.new('RGB', (width, height), color=(255, 255, 255))
    
    draw = ImageDraw.Draw(base)
    
    # ============================================
    # STEP 2: ADD HEADER SECTION
    # ============================================
    
    # Load fonts
    title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
    subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
    body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
    stat_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 64)
    
    # Title
    draw.text((width//2, 80), data.title, font=title_font, fill=(255, 255, 255), anchor="mt")
    
    # Subtitle
    draw.text((width//2, 170), data.subtitle, font=subtitle_font, fill=(200, 200, 200), anchor="mt")
    
    # Decorative line
    draw.line([(100, 230), (width-100, 230)], fill=(255, 255, 255), width=2)
    
    # ============================================
    # STEP 3: ADD KEY STATISTICS SECTION
    # ============================================
    
    y_offset = 280
    stat_box_width = 300
    stat_box_height = 150
    stats_per_row = 3
    
    for idx, stat in enumerate(data.key_stats):
        row = idx // stats_per_row
        col = idx % stats_per_row
        
        x = 100 + col * (stat_box_width + 50)
        y = y_offset + row * (stat_box_height + 30)
        
        # Draw stat box
        draw.rounded_rectangle(
            [(x, y), (x + stat_box_width, y + stat_box_height)],
            radius=15,
            fill=(255, 255, 255, 30)
        )
        
        # Stat value
        draw.text((x + stat_box_width//2, y + 30), stat.value, 
                  font=stat_font, fill=(255, 200, 50), anchor="mt")
        
        # Stat label
        draw.text((x + stat_box_width//2, y + 110), stat.label,
                  font=body_font, fill=(255, 255, 255), anchor="mt")
    
    # ============================================
    # STEP 4: ADD CHART SECTION
    # ============================================
    
    y_offset = 700
    
    # Generate chart using matplotlib
    chart_image = await generate_chart_for_infographic(
        data.chart_data,
        width=1000,
        height=400
    )
    
    # Paste chart onto infographic
    base.paste(chart_image, (100, y_offset))
    
    # ============================================
    # STEP 5: ADD ICON STATISTICS
    # ============================================
    
    y_offset = 1150
    
    for idx, item in enumerate(data.icon_stats):
        x = 150 + (idx % 2) * 550
        y = y_offset + (idx // 2) * 200
        
        # Load and paste icon
        icon = Image.open(item.icon_path).resize((80, 80))
        base.paste(icon, (x, y), icon if icon.mode == 'RGBA' else None)
        
        # Add text next to icon
        draw.text((x + 100, y + 10), item.value, font=stat_font, fill=(255, 255, 255))
        draw.text((x + 100, y + 70), item.description, font=body_font, fill=(200, 200, 200))
    
    # ============================================
    # STEP 6: ADD TIMELINE/PROCESS SECTION
    # ============================================
    
    y_offset = 1600
    
    # Section header
    draw.text((width//2, y_offset), "Process Overview", font=title_font, 
              fill=(255, 255, 255), anchor="mt")
    
    y_offset += 100
    
    # Draw timeline
    timeline_y = y_offset + 50
    draw.line([(150, timeline_y), (width-150, timeline_y)], fill=(255, 255, 255), width=4)
    
    step_width = (width - 300) // len(data.process_steps)
    
    for idx, step in enumerate(data.process_steps):
        x = 150 + idx * step_width + step_width // 2
        
        # Circle on timeline
        draw.ellipse([(x-20, timeline_y-20), (x+20, timeline_y+20)], 
                     fill=(255, 200, 50), outline=(255, 255, 255), width=3)
        
        # Step number
        draw.text((x, timeline_y), str(idx + 1), font=body_font, 
                  fill=(30, 60, 114), anchor="mm")
        
        # Step title
        draw.text((x, timeline_y + 50), step.title, font=body_font,
                  fill=(255, 255, 255), anchor="mt")
        
        # Step description (wrapped)
        wrapped_text = wrap_text(step.description, 20)
        draw.text((x, timeline_y + 90), wrapped_text, font=ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20),
            fill=(200, 200, 200), anchor="mt")
    
    # ============================================
    # STEP 7: ADD FOOTER
    # ============================================
    
    # Footer background
    draw.rectangle([(0, height-120), (width, height)], fill=(20, 40, 80))
    
    # Source text
    draw.text((100, height-80), f"Source: {data.source}", font=body_font, fill=(150, 150, 150))
    
    # Logo/branding
    draw.text((width-100, height-80), data.brand, font=body_font, fill=(255, 255, 255), anchor="rt")
    
    # ============================================
    # STEP 8: SAVE OUTPUT
    # ============================================
    
    base.save(output_path, 'PNG', quality=95)
    return output_path


def create_gradient_background(width: int, height: int, start_color: tuple, end_color: tuple) -> Image:
    """Create a vertical gradient background."""
    base = Image.new('RGB', (width, height), start_color)
    
    for y in range(height):
        ratio = y / height
        r = int(start_color[0] + (end_color[0] - start_color[0]) * ratio)
        g = int(start_color[1] + (end_color[1] - start_color[1]) * ratio)
        b = int(start_color[2] + (end_color[2] - start_color[2]) * ratio)
        
        for x in range(width):
            base.putpixel((x, y), (r, g, b))
    
    return base


async def generate_chart_for_infographic(data: dict, width: int, height: int) -> Image:
    """Generate a chart as PIL Image for embedding in infographic."""
    
    fig, ax = plt.subplots(figsize=(width/100, height/100), dpi=100)
    fig.patch.set_alpha(0)
    ax.patch.set_alpha(0)
    
    # Create chart
    bars = ax.bar(data['labels'], data['values'], color='#FFC832')
    
    # Style for dark background
    ax.tick_params(colors='white')
    ax.xaxis.label.set_color('white')
    ax.yaxis.label.set_color('white')
    ax.title.set_color('white')
    
    for spine in ax.spines.values():
        spine.set_color('white')
    
    ax.set_title(data.get('title', ''), fontsize=14, fontweight='bold')
    
    # Save to buffer
    buf = BytesIO()
    plt.savefig(buf, format='png', transparent=True, bbox_inches='tight')
    buf.seek(0)
    plt.close()
    
    return Image.open(buf)
```

---

## 7. Website Generation

### 7.1 System Architecture

Website generation uses the `webdev_*` tool suite for full-stack web application development.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Requirements   │────▶│  Project Init   │────▶│  Code Generation│
│  Analysis       │     │  (webdev_init)  │     │  (file writes)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Dev Server     │
                                              │  (Vite + HMR)   │
                                              └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Preview &      │
                                              │  Iteration      │
                                              └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Checkpoint &   │
                                              │  Publish        │
                                              └─────────────────┘
```

### 7.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 19 + TypeScript | UI components |
| **Styling** | Tailwind CSS 4 + shadcn/ui | Design system |
| **Backend** | Express + tRPC | API layer |
| **Database** | MySQL/TiDB + Drizzle ORM | Data persistence |
| **Auth** | Manus OAuth | User authentication |
| **Build** | Vite | Development & bundling |

### 7.3 Pseudocode: Website Generation

```typescript
// Website generation workflow
async function generateWebsite(requirements: WebsiteRequirements): Promise<WebsiteResult> {
  
  // ============================================
  // PHASE 1: PROJECT INITIALIZATION
  // ============================================
  
  // Initialize project with appropriate template
  const project = await webdev_init_project({
    name: requirements.projectName,
    template: determineTemplate(requirements),  // 'web-static', 'web-db-user', etc.
    description: requirements.description,
  });
  
  // ============================================
  // PHASE 2: CREATE TODO.MD
  // ============================================
  
  // MUST create todo.md as first action after init
  await file_write(`${project.path}/todo.md`, `
# ${requirements.projectName} - Project TODO

## Core Features
${requirements.features.map(f => `- [ ] ${f}`).join('\n')}

## Design
- [ ] Color scheme and typography
- [ ] Responsive layout
- [ ] Component library setup

## Implementation Status
1. [ ] Database schema
2. [ ] Backend API
3. [ ] Frontend pages
4. [ ] Testing
5. [ ] Deployment
  `);
  
  // ============================================
  // PHASE 3: DATABASE SCHEMA (if applicable)
  // ============================================
  
  if (project.features.includes('db')) {
    // Design and write schema
    const schema = await generateDatabaseSchema(requirements);
    
    await file_write(`${project.path}/drizzle/schema.ts`, schema);
    
    // Push schema to database
    await shell_exec('cd ${project.path} && pnpm db:push');
  }
  
  // ============================================
  // PHASE 4: BACKEND API
  // ============================================
  
  if (project.features.includes('server')) {
    // Generate tRPC routers
    const routers = await generateTRPCRouters(requirements);
    
    await file_write(`${project.path}/server/routers.ts`, routers);
    
    // Generate database helpers
    const dbHelpers = await generateDBHelpers(requirements);
    
    await file_write(`${project.path}/server/db.ts`, dbHelpers);
  }
  
  // ============================================
  // PHASE 5: FRONTEND PAGES
  // ============================================
  
  // Generate pages based on requirements
  for (const page of requirements.pages) {
    const pageCode = await generatePageComponent(page, requirements.designStyle);
    
    await file_write(`${project.path}/client/src/pages/${page.name}.tsx`, pageCode);
  }
  
  // Update App.tsx with routes
  const appCode = await generateAppRouter(requirements.pages);
  await file_write(`${project.path}/client/src/App.tsx`, appCode);
  
  // Update global styles
  const styles = await generateGlobalStyles(requirements.designStyle);
  await file_write(`${project.path}/client/src/index.css`, styles);
  
  // ============================================
  // PHASE 6: TESTING
  // ============================================
  
  // Generate vitest tests
  const tests = await generateTests(requirements);
  
  for (const test of tests) {
    await file_write(`${project.path}/server/${test.name}.test.ts`, test.code);
  }
  
  // Run tests
  await shell_exec('cd ${project.path} && pnpm test');
  
  // ============================================
  // PHASE 7: CHECKPOINT & DELIVERY
  // ============================================
  
  // Update todo.md with completed items
  await markTodoComplete(project.path, requirements.features);
  
  // Save checkpoint
  const checkpoint = await webdev_save_checkpoint({
    description: `Initial implementation of ${requirements.projectName}`,
  });
  
  return {
    projectPath: project.path,
    previewUrl: project.previewUrl,
    checkpointId: checkpoint.versionId,
  };
}


// Page component generation
async function generatePageComponent(
  page: PageSpec,
  designStyle: DesignStyle
): Promise<string> {
  
  // Use LLM to generate component code
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are a React/TypeScript expert. Generate a page component using:
- React 19 with TypeScript
- Tailwind CSS 4 for styling
- shadcn/ui components (import from @/components/ui/*)
- tRPC hooks for data fetching (trpc.*.useQuery/useMutation)
- Design style: ${designStyle.description}
- Color palette: ${designStyle.colors.join(', ')}`
      },
      {
        role: 'user',
        content: `Generate a ${page.name} page component with these features:
${page.features.map(f => `- ${f}`).join('\n')}

The page should:
- Be fully responsive
- Handle loading and error states
- Use proper TypeScript types
- Follow React best practices`
      }
    ]
  });
  
  return response.choices[0].message.content;
}


// Database schema generation
async function generateDatabaseSchema(requirements: WebsiteRequirements): Promise<string> {
  
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are a database architect. Generate a Drizzle ORM schema for MySQL/TiDB.
Use these imports:
import { mysqlTable, varchar, text, int, boolean, timestamp, json } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';`
      },
      {
        role: 'user',
        content: `Design a database schema for: ${requirements.description}

Required entities:
${requirements.entities.map(e => `- ${e.name}: ${e.fields.join(', ')}`).join('\n')}

Include:
- Proper primary keys (id as varchar(36) with cuid())
- Created/updated timestamps
- Foreign key relationships
- Indexes for common queries`
      }
    ]
  });
  
  return response.choices[0].message.content;
}
```

---

## 8. PDF Generation

### 8.1 System Architecture

PDF generation supports multiple approaches depending on the source content.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PDF GENERATION PATHS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐           │
│  │  Markdown   │────▶│ manus-md-to-pdf │────▶│     PDF         │           │
│  │  Source     │     │ (CLI utility)   │     │                 │           │
│  └─────────────┘     └─────────────────┘     └─────────────────┘           │
│                                                                              │
│  ┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐           │
│  │  HTML/CSS   │────▶│   WeasyPrint    │────▶│     PDF         │           │
│  │  Source     │     │   (Python)      │     │                 │           │
│  └─────────────┘     └─────────────────┘     └─────────────────┘           │
│                                                                              │
│  ┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐           │
│  │  Raw Data   │────▶│  ReportLab/     │────▶│     PDF         │           │
│  │  & Content  │     │  FPDF2          │     │                 │           │
│  └─────────────┘     └─────────────────┘     └─────────────────┘           │
│                                                                              │
│  ┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐           │
│  │  Slides     │────▶│ manus-export-   │────▶│     PDF         │           │
│  │  (manus://) │     │ slides          │     │                 │           │
│  └─────────────┘     └─────────────────┘     └─────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Pseudocode: PDF Generation

```python
# Method 1: Markdown to PDF (simplest)
async def markdown_to_pdf(
    markdown_path: str,
    output_path: str
) -> str:
    """
    Convert Markdown to PDF using manus-md-to-pdf utility.
    Handles formatting, code blocks, tables, and images.
    """
    await shell_exec(
        f"manus-md-to-pdf {markdown_path} {output_path}",
        timeout=60
    )
    return output_path


# Method 2: HTML to PDF (for complex layouts)
async def html_to_pdf(
    html_content: str,
    output_path: str,
    css_path: str = None
) -> str:
    """
    Convert HTML to PDF using WeasyPrint.
    Supports full CSS including flexbox, grid, and print styles.
    """
    from weasyprint import HTML, CSS
    
    # Create HTML document
    html_doc = HTML(string=html_content)
    
    # Apply custom CSS if provided
    stylesheets = []
    if css_path:
        stylesheets.append(CSS(filename=css_path))
    
    # Add print-specific styles
    print_css = CSS(string="""
        @page {
            size: A4;
            margin: 2cm;
            @top-center {
                content: "SwissBrain Report";
            }
            @bottom-center {
                content: "Page " counter(page) " of " counter(pages);
            }
        }
        
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.6;
        }
        
        h1 { page-break-before: always; }
        h1:first-of-type { page-break-before: avoid; }
        
        table { page-break-inside: avoid; }
        
        .no-break { page-break-inside: avoid; }
    """)
    stylesheets.append(print_css)
    
    # Generate PDF
    html_doc.write_pdf(output_path, stylesheets=stylesheets)
    
    return output_path


# Method 3: Programmatic PDF (for data-driven reports)
async def generate_report_pdf(
    report_data: ReportData,
    output_path: str
) -> str:
    """
    Generate a structured PDF report using ReportLab.
    Best for invoices, reports, and data-heavy documents.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm, mm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        Image, PageBreak, ListFlowable, ListItem
    )
    from reportlab.graphics.shapes import Drawing, Line
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    
    # Create document
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )
    
    # Get styles
    styles = getSampleStyleSheet()
    
    # Custom styles
    styles.add(ParagraphStyle(
        name='CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        textColor=colors.HexColor('#1F4E79')
    ))
    
    styles.add(ParagraphStyle(
        name='SectionHeader',
        parent=styles['Heading2'],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#2E75B6')
    ))
    
    # Build content
    story = []
    
    # ============================================
    # COVER PAGE
    # ============================================
    
    # Logo
    if report_data.logo_path:
        logo = Image(report_data.logo_path, width=5*cm, height=2*cm)
        story.append(logo)
    
    story.append(Spacer(1, 2*cm))
    
    # Title
    story.append(Paragraph(report_data.title, styles['CustomTitle']))
    
    # Subtitle
    story.append(Paragraph(report_data.subtitle, styles['Heading3']))
    
    story.append(Spacer(1, 1*cm))
    
    # Metadata
    meta_data = [
        ['Date:', report_data.date],
        ['Author:', report_data.author],
        ['Version:', report_data.version],
    ]
    meta_table = Table(meta_data, colWidths=[3*cm, 10*cm])
    meta_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_table)
    
    story.append(PageBreak())
    
    # ============================================
    # TABLE OF CONTENTS
    # ============================================
    
    story.append(Paragraph('Table of Contents', styles['SectionHeader']))
    
    toc_data = [[f'{idx+1}. {section.title}', f'Page {section.page}'] 
                for idx, section in enumerate(report_data.sections)]
    
    toc_table = Table(toc_data, colWidths=[12*cm, 3*cm])
    toc_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ]))
    story.append(toc_table)
    
    story.append(PageBreak())
    
    # ============================================
    # CONTENT SECTIONS
    # ============================================
    
    for section in report_data.sections:
        # Section header
        story.append(Paragraph(section.title, styles['SectionHeader']))
        
        # Section content
        for paragraph in section.paragraphs:
            story.append(Paragraph(paragraph, styles['Normal']))
            story.append(Spacer(1, 0.5*cm))
        
        # Tables
        if section.tables:
            for table_data in section.tables:
                # Create table
                t = Table(
                    [table_data.headers] + table_data.rows,
                    colWidths=[4*cm] * len(table_data.headers)
                )
                t.setStyle(TableStyle([
                    # Header style
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('TOPPADDING', (0, 0), (-1, 0), 12),
                    
                    # Body style
                    ('FONTSIZE', (0, 1), (-1, -1), 9),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
                    ('TOPPADDING', (0, 1), (-1, -1), 8),
                    
                    # Alternating row colors
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), 
                     [colors.white, colors.HexColor('#F2F2F2')]),
                    
                    # Grid
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ]))
                story.append(t)
                story.append(Spacer(1, 0.5*cm))
        
        # Charts
        if section.charts:
            for chart_data in section.charts:
                drawing = Drawing(400, 200)
                
                chart = VerticalBarChart()
                chart.x = 50
                chart.y = 50
                chart.height = 125
                chart.width = 300
                chart.data = [chart_data.values]
                chart.categoryAxis.categoryNames = chart_data.labels
                chart.bars[0].fillColor = colors.HexColor('#2E75B6')
                
                drawing.add(chart)
                story.append(drawing)
                story.append(Spacer(1, 0.5*cm))
        
        # Images
        if section.images:
            for img_data in section.images:
                img = Image(img_data.path, width=12*cm, height=8*cm)
                story.append(img)
                story.append(Paragraph(
                    f'<i>{img_data.caption}</i>',
                    styles['Normal']
                ))
                story.append(Spacer(1, 0.5*cm))
    
    # ============================================
    # BUILD PDF
    # ============================================
    
    doc.build(story)
    return output_path


# Method 4: FPDF2 for simpler PDFs
async def generate_simple_pdf(
    content: SimpleContent,
    output_path: str
) -> str:
    """
    Generate a simple PDF using FPDF2.
    Lighter weight than ReportLab, good for basic documents.
    """
    from fpdf import FPDF
    
    class PDF(FPDF):
        def header(self):
            self.set_font('Helvetica', 'B', 12)
            self.cell(0, 10, content.header_text, align='C', new_x='LMARGIN', new_y='NEXT')
            self.ln(5)
        
        def footer(self):
            self.set_y(-15)
            self.set_font('Helvetica', 'I', 8)
            self.cell(0, 10, f'Page {self.page_no()}/{{nb}}', align='C')
    
    pdf = PDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # Title
    pdf.set_font('Helvetica', 'B', 24)
    pdf.cell(0, 20, content.title, align='C', new_x='LMARGIN', new_y='NEXT')
    
    # Body
    pdf.set_font('Helvetica', '', 11)
    pdf.multi_cell(0, 7, content.body)
    
    pdf.output(output_path)
    return output_path
```

---

## 9. Unified Document Pipeline

### 9.1 Pipeline Architecture

```python
from enum import Enum
from dataclasses import dataclass
from typing import Union, List, Optional

class DocumentType(Enum):
    SLIDES = "slides"
    EXCEL = "excel"
    IMAGE = "image"
    WORD = "word"
    PDF = "pdf"
    INFOGRAPHIC = "infographic"
    WEBSITE = "website"

@dataclass
class DocumentRequest:
    type: DocumentType
    content: dict
    style: Optional[str] = "modern"
    output_format: Optional[str] = None
    template: Optional[str] = None

@dataclass
class DocumentResult:
    success: bool
    output_path: str
    preview_url: Optional[str] = None
    metadata: Optional[dict] = None

class DocumentPipeline:
    """
    Unified document generation pipeline that routes requests
    to appropriate generators based on document type.
    """
    
    def __init__(self):
        self.generators = {
            DocumentType.SLIDES: SlidesGenerator(),
            DocumentType.EXCEL: ExcelGenerator(),
            DocumentType.IMAGE: ImageGenerator(),
            DocumentType.WORD: WordGenerator(),
            DocumentType.PDF: PDFGenerator(),
            DocumentType.INFOGRAPHIC: InfographicGenerator(),
            DocumentType.WEBSITE: WebsiteGenerator(),
        }
    
    async def generate(self, request: DocumentRequest) -> DocumentResult:
        """
        Main entry point for document generation.
        """
        
        # Phase 1: Validate request
        self.validate_request(request)
        
        # Phase 2: Prepare content (research, data gathering)
        prepared_content = await self.prepare_content(request)
        
        # Phase 3: Route to appropriate generator
        generator = self.generators[request.type]
        
        # Phase 4: Generate document
        result = await generator.generate(prepared_content, request.style)
        
        # Phase 5: Post-process (convert format if needed)
        if request.output_format:
            result = await self.convert_format(result, request.output_format)
        
        return result
    
    async def prepare_content(self, request: DocumentRequest) -> dict:
        """
        Prepare content by gathering data, researching, and structuring.
        """
        
        # If content needs research
        if request.content.get('needs_research'):
            research = await search(
                type="info",
                queries=request.content['research_queries']
            )
            request.content['research_data'] = research
        
        # If content needs data from APIs
        if request.content.get('data_sources'):
            for source in request.content['data_sources']:
                data = await fetch_data(source)
                request.content[f'data_{source.name}'] = data
        
        # If content needs images
        if request.content.get('needs_images'):
            images = []
            for prompt in request.content['image_prompts']:
                image = await generate_image(prompt)
                images.append(image)
            request.content['generated_images'] = images
        
        return request.content
    
    async def convert_format(
        self, 
        result: DocumentResult, 
        target_format: str
    ) -> DocumentResult:
        """
        Convert document to different format if needed.
        """
        
        conversions = {
            ('slides', 'pdf'): lambda p: shell_exec(f"manus-export-slides {p} pdf"),
            ('slides', 'pptx'): lambda p: shell_exec(f"manus-export-slides {p} ppt"),
            ('markdown', 'pdf'): lambda p: shell_exec(f"manus-md-to-pdf {p} {p.replace('.md', '.pdf')}"),
            ('html', 'pdf'): lambda p: html_to_pdf(p),
        }
        
        source_format = self.detect_format(result.output_path)
        conversion_key = (source_format, target_format)
        
        if conversion_key in conversions:
            new_path = await conversions[conversion_key](result.output_path)
            result.output_path = new_path
        
        return result


# Usage example
async def handle_document_request(user_message: str):
    """
    Parse user request and generate appropriate document.
    """
    
    # Analyze request with LLM
    analysis = await invokeLLM({
        "messages": [
            {
                "role": "system",
                "content": """Analyze the user's document request and extract:
                - document_type: slides, excel, image, word, pdf, infographic, website
                - content_requirements: what content is needed
                - style_preferences: any style/design preferences
                - output_format: desired output format if specified"""
            },
            {"role": "user", "content": user_message}
        ],
        "response_format": {"type": "json_object"}
    })
    
    request = DocumentRequest(
        type=DocumentType(analysis['document_type']),
        content=analysis['content_requirements'],
        style=analysis.get('style_preferences', 'modern'),
        output_format=analysis.get('output_format')
    )
    
    pipeline = DocumentPipeline()
    result = await pipeline.generate(request)
    
    return result
```

### 9.2 Integration Summary

| Document Type | Primary Tool | Content Prep | Rendering | Export Options |
|---------------|--------------|--------------|-----------|----------------|
| **Slides** | `slides` mode | Research + Outline + Images | HTML or Image mode | PPTX, PDF |
| **Excel** | Python `openpyxl` | Data gathering + Transform | Direct generation | XLSX |
| **Images** | `generate` mode | Prompt engineering | AI generation | PNG, JPG, WebP |
| **Word** | Python `python-docx` | Content structuring | Direct generation | DOCX |
| **PDF** | Multiple options | Depends on source | WeasyPrint/ReportLab | PDF |
| **Infographics** | Hybrid | Data + Design | Pillow composite | PNG, SVG |
| **Websites** | `webdev_*` tools | Requirements analysis | Full-stack generation | Live URL |

---

## References

1. openpyxl Documentation: https://openpyxl.readthedocs.io/
2. python-docx Documentation: https://python-docx.readthedocs.io/
3. ReportLab User Guide: https://www.reportlab.com/docs/reportlab-userguide.pdf
4. WeasyPrint Documentation: https://doc.courtbouillon.org/weasyprint/
5. Pillow (PIL) Documentation: https://pillow.readthedocs.io/
6. Matplotlib Documentation: https://matplotlib.org/stable/contents.html
7. Mermaid Diagram Syntax: https://mermaid.js.org/syntax/
8. D2 Language Documentation: https://d2lang.com/

---

*This document provides comprehensive technical specifications for document generation in the Manus platform. All code examples are implementable using the available sandbox tools and libraries.*
