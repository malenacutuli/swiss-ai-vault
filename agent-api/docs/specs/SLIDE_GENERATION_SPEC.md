# Slide Generation System Specification

**Status**: CANONICAL SPEC
**Source**: Manus.im Slide Generation System
**Added to Intel Index**: 2026-01-18

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Slide Generation Modes](#2-slide-generation-modes)
3. [Core System Prompts](#3-core-system-prompts)
4. [Nano Banana Image-Based Slides](#4-nano-banana-image-based-slides)
5. [Style Templates Detailed Specifications](#5-style-templates-detailed-specifications)
6. [HTML/CSS Slide Generation](#6-htmlcss-slide-generation)
7. [Image Generation Pipeline](#7-image-generation-pipeline)
8. [Content Processing](#8-content-processing)
9. [Rendering Engine](#9-rendering-engine)
10. [API Contracts](#10-api-contracts)

---

## 1. Architecture Overview

### 1.1 High-Level Flow

```
User Request → Content Analyzer → Style Selector →
  ├─→ HTML Mode → HTML/CSS Generator → Chart.js Integration → Output
  └─→ Image Mode → Slide Composer → Image Generator → Output
```

### 1.2 Two Generation Modes

| Mode | Output | Editability | Visual Quality | Use Case |
|------|--------|-------------|----------------|----------|
| `html` | HTML/CSS + Chart.js | Fully editable | Good | Data-heavy, user-editable |
| `image` | Rendered images | Not editable | Stunning | Artistic, presentation-ready |

### 1.3 Core Components

```python
@dataclass
class SlideGenerationRequest:
    content_file_path: str          # Path to markdown content outline
    slide_count: int                # Total number of slides
    generate_mode: str              # 'html' or 'image'
    style: Optional[str] = None     # Style template name (for image mode)
    aspect_ratio: str = "16:9"      # Slide aspect ratio
    theme: str = "dark"             # 'dark' or 'light'
    brand_colors: Optional[List[str]] = None  # Custom brand colors
    font_family: Optional[str] = None  # Custom font

@dataclass
class SlideGenerationResult:
    version_id: str                 # Unique version identifier
    slides: List[Slide]             # Generated slides
    uri: str                        # manus-slides://{version_id}
    export_formats: List[str]       # Available export formats
```

---

## 2. Slide Generation Modes

### 2.1 HTML Mode (Default)

**When to Use:**
- Data-heavy presentations with charts
- User needs to edit slides after generation
- Corporate/business presentations
- Quick iterations needed

**Technology Stack:**
- HTML5 + CSS3
- Tailwind CSS for styling
- Chart.js for data visualization
- Custom CSS variables for theming

**Output:**
- Editable HTML/CSS files
- Embedded Chart.js visualizations
- Exportable to PDF/PPTX via UI

### 2.2 Image Mode (Nano Banana)

**When to Use:**
- User mentions "nano banana slides"
- User requests "generate slides as images"
- Artistic/creative presentations
- Visually stunning output required
- Style-specific templates (Vinyl, Whiteboard, etc.)

**Technology Stack:**
- AI image generation (Stable Diffusion / DALL-E)
- ComfyUI for style-specific rendering
- Custom LoRA models per style
- Post-processing pipeline

**Output:**
- High-resolution PNG images (1920x1080 for 16:9)
- One image per slide
- Not editable (regenerate to change)

---

## 3. Core System Prompts

### 3.1 Content Analysis System Prompt

```
You are a presentation content architect. Your task is to analyze the provided content outline and structure it into presentation slides.

INSTRUCTIONS:
1. Parse the markdown content outline
2. Identify key sections, themes, and data points
3. Determine optimal slide count and flow
4. Extract text, bullet points, and data for each slide
5. Identify opportunities for visual elements (charts, images, icons)

OUTPUT FORMAT:
For each slide, provide:
- slide_number: integer
- slide_type: "title" | "content" | "section" | "data" | "quote" | "image" | "comparison" | "timeline" | "conclusion"
- headline: string (max 10 words)
- subheadline: string (optional, max 15 words)
- body_text: string[] (bullet points or paragraphs)
- data: object (for charts/tables)
- visual_suggestion: string (description of visual element)
- speaker_notes: string (optional)

CONSTRAINTS:
- Title slide must be first
- Conclusion/CTA slide should be last
- Max 6 bullet points per slide
- Max 25 words per bullet point
- Data slides must include chart type recommendation
```

### 3.2 HTML Slide Generation System Prompt

```
You are a presentation designer specializing in HTML/CSS slides. Generate clean, modern, responsive slide HTML.

DESIGN PRINCIPLES:
1. Visual hierarchy: Headlines > Subheadlines > Body
2. Whitespace: Generous padding and margins
3. Typography: Clear contrast between text levels
4. Color: Use CSS variables for theming
5. Accessibility: Proper contrast ratios, semantic HTML

HTML STRUCTURE:
<div class="slide" data-slide-number="{n}" data-slide-type="{type}">
  <div class="slide-content">
    <h1 class="headline">{headline}</h1>
    <h2 class="subheadline">{subheadline}</h2>
    <div class="body">
      {content}
    </div>
    <div class="visual">
      {chart_or_image}
    </div>
  </div>
  <div class="slide-footer">
    <span class="slide-number">{n} / {total}</span>
  </div>
</div>

CSS VARIABLES (must use):
--slide-bg: Background color
--slide-text: Primary text color
--slide-accent: Accent/highlight color
--slide-muted: Secondary text color
--font-headline: Headline font family
--font-body: Body font family

CHART.JS INTEGRATION:
- Use Chart.js for all data visualizations
- Include data inline in script tags
- Use CSS variable colors for chart elements
- Responsive sizing with aspectRatio option
```

### 3.3 Image Mode Master System Prompt

```
You are a visual presentation designer creating image-based slides. Each slide will be rendered as a single high-quality image.

WORKFLOW:
1. Receive slide content (headline, body, data)
2. Compose visual layout based on style template
3. Generate detailed image prompt
4. Apply style-specific modifiers
5. Output image generation parameters

IMAGE COMPOSITION RULES:
1. Text placement: Upper third for headlines, center for body
2. Visual balance: 60% content area, 40% visual/whitespace
3. Focal point: Single clear focal point per slide
4. Brand consistency: Maintain style throughout deck

OUTPUT FORMAT:
{
  "slide_number": 1,
  "image_prompt": "detailed prompt for image generation",
  "negative_prompt": "elements to avoid",
  "style_modifiers": ["modifier1", "modifier2"],
  "text_overlays": [
    {"text": "Headline", "position": "top-center", "style": "headline"},
    {"text": "Body text", "position": "center", "style": "body"}
  ],
  "composition": {
    "layout": "centered" | "left-heavy" | "right-heavy" | "split",
    "background_type": "solid" | "gradient" | "textured" | "image",
    "visual_elements": ["element1", "element2"]
  }
}
```

---

## 4. Nano Banana Image-Based Slides

### 4.1 Overview

Nano Banana is the image-based slide generation system that produces visually stunning, non-editable slides. Each slide is rendered as a single image with text overlays.

### 4.2 Style Templates

| Style | Description | Best For | Color Palette |
|-------|-------------|----------|---------------|
| **Vinyl** | Retro record aesthetic | Music, creative | Black, gold, warm tones |
| **Whiteboard** | Hand-drawn sketch look | Education, workshops | White, black, markers |
| **Grove** | Natural, organic feel | Environmental, wellness | Greens, browns, earth |
| **Fresco** | Classical painting style | Art, history, luxury | Rich, muted, classical |
| **Easel** | Artist studio aesthetic | Creative, design | Canvas, paint strokes |
| **Diorama** | 3D miniature scenes | Product, storytelling | Varied, depth-focused |
| **Chromatic** | Bold color gradients | Tech, modern | Vibrant gradients |
| **Sketch** | Pencil drawing style | Concepts, drafts | Graphite, paper |
| **Amber** | Warm golden tones | Luxury, premium | Amber, gold, bronze |
| **Ginkgo** | Japanese minimalism | Zen, mindfulness | Soft greens, cream |
| **Neon** | Cyberpunk glow | Tech, gaming | Neon pink, blue, purple |
| **Paper** | Craft paper texture | DIY, handmade | Kraft, muted colors |
| **Blueprint** | Technical drawing | Engineering, architecture | Blue, white lines |
| **Polaroid** | Instant photo style | Personal, memories | White borders, faded |
| **Mosaic** | Tile pattern aesthetic | Culture, diversity | Multi-colored tiles |

### 4.3 Style Selection Logic

```python
def select_style(user_request: str, content_analysis: dict) -> str:
    """
    Select appropriate style based on user request and content.
    """
    # Explicit style request
    explicit_styles = {
        "vinyl": "vinyl",
        "whiteboard": "whiteboard",
        "grove": "grove",
        "fresco": "fresco",
        "easel": "easel",
        "diorama": "diorama",
        "chromatic": "chromatic",
        "sketch": "sketch",
        "amber": "amber",
        "ginkgo": "ginkgo",
        "neon": "neon",
        "paper": "paper",
        "blueprint": "blueprint",
        "polaroid": "polaroid",
        "mosaic": "mosaic",
    }

    for keyword, style in explicit_styles.items():
        if keyword in user_request.lower():
            return style

    # Content-based selection
    content_type = content_analysis.get("primary_theme", "")

    style_mapping = {
        "technology": "chromatic",
        "nature": "grove",
        "education": "whiteboard",
        "art": "easel",
        "history": "fresco",
        "music": "vinyl",
        "business": "amber",
        "wellness": "ginkgo",
        "gaming": "neon",
        "engineering": "blueprint",
        "personal": "polaroid",
        "culture": "mosaic",
        "concept": "sketch",
        "product": "diorama",
        "craft": "paper",
    }

    return style_mapping.get(content_type, "chromatic")  # Default
```

---

## 5. Style Templates Detailed Specifications

### 5.1 VINYL Style

**Visual Identity:**
- Retro vinyl record aesthetic
- Circular motifs and grooves
- Warm, nostalgic color palette
- Album cover inspired layouts

**Color Palette:**
```css
:root {
  --vinyl-bg: #1a1a1a;
  --vinyl-primary: #d4af37;
  --vinyl-secondary: #8b7355;
  --vinyl-accent: #cd853f;
  --vinyl-text: #f5f5dc;
  --vinyl-muted: #a0a0a0;
}
```

**Image Generation Prompt Template:**
```
{content_description}, vinyl record aesthetic, retro album cover style,
circular grooves pattern, warm golden lighting, vintage typography,
1970s music industry aesthetic, high contrast, dramatic shadows,
black background with gold accents, professional presentation slide
```

**Negative Prompt:**
```
modern, digital, cold colors, blue tones, minimalist, flat design,
corporate, sterile, bright white, neon
```

### 5.2 WHITEBOARD Style

**Visual Identity:**
- Hand-drawn sketch aesthetic
- Marker and pen strokes
- Educational, workshop feel
- Clean white background with colorful annotations

**Color Palette:**
```css
:root {
  --whiteboard-bg: #f8f8f8;
  --whiteboard-primary: #2c3e50;
  --whiteboard-red: #e74c3c;
  --whiteboard-blue: #3498db;
  --whiteboard-green: #27ae60;
  --whiteboard-orange: #f39c12;
  --whiteboard-purple: #9b59b6;
}
```

### 5.3 GROVE Style

**Visual Identity:**
- Natural, organic aesthetic
- Forest and plant imagery
- Earth tones and greens
- Sustainable, eco-friendly feel

**Color Palette:**
```css
:root {
  --grove-bg: #f5f0e6;
  --grove-primary: #2d5a27;
  --grove-secondary: #8b7355;
  --grove-accent: #d4a574;
  --grove-text: #3d3d3d;
  --grove-light: #e8e0d5;
}
```

### 5.4 FRESCO Style

**Visual Identity:**
- Classical Renaissance painting aesthetic
- Rich, muted colors
- Artistic, museum-quality feel
- Textured, aged appearance

### 5.5 EASEL Style

**Visual Identity:**
- Artist studio aesthetic
- Canvas and paint textures
- Creative, expressive feel
- Visible brush strokes

### 5.6 DIORAMA Style

**Visual Identity:**
- 3D miniature scene aesthetic
- Depth and layers
- Tilt-shift photography feel
- Storytelling through scenes

### 5.7 CHROMATIC Style (Default)

**Visual Identity:**
- Bold color gradients
- Modern, tech-forward
- Vibrant and energetic
- Futuristic aesthetic

**Color Palette:**
```css
:root {
  --chromatic-bg: #0f0f1a;
  --chromatic-primary: #667eea;
  --chromatic-secondary: #764ba2;
  --chromatic-accent: #f093fb;
  --chromatic-text: #ffffff;
  --chromatic-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
}
```

### 5.8 SKETCH Style

**Visual Identity:**
- Pencil drawing aesthetic
- Conceptual, draft feel
- Graphite and paper texture
- Architectural sketch style

### 5.9 AMBER Style

**Visual Identity:**
- Warm golden tones
- Luxury, premium feel
- Elegant and sophisticated
- Honey and bronze accents

### 5.10 GINKGO Style

**Visual Identity:**
- Japanese minimalism
- Zen, peaceful aesthetic
- Soft, muted colors
- Nature-inspired simplicity

### 5.11 NEON Style

**Visual Identity:**
- Cyberpunk glow aesthetic
- Neon lights on dark background
- Tech, gaming feel
- Futuristic urban vibe

### 5.12 PAPER Style

**Visual Identity:**
- Craft paper texture
- Handmade, DIY feel
- Warm, tactile aesthetic
- Scrapbook inspiration

### 5.13 BLUEPRINT Style

**Visual Identity:**
- Technical drawing aesthetic
- Blue background with white lines
- Engineering, architecture feel
- Grid and measurement marks

### 5.14 POLAROID Style

**Visual Identity:**
- Instant photo aesthetic
- White borders, faded colors
- Personal, nostalgic feel
- Memory and moments

### 5.15 MOSAIC Style

**Visual Identity:**
- Tile pattern aesthetic
- Multi-colored, diverse
- Cultural, artistic feel
- Geometric patterns

---

## 6. HTML/CSS Slide Generation

### 6.1 Base HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{presentation_title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    {base_styles}
    {theme_styles}
  </style>
</head>
<body>
  <div class="presentation" data-theme="{theme}">
    {slides}
  </div>
  <script>
    {chart_scripts}
    {navigation_script}
  </script>
</body>
</html>
```

### 6.2 Theme CSS Variables

```css
/* Dark Theme */
.presentation[data-theme="dark"] {
  --slide-bg: #0f0f1a;
  --slide-text: #ffffff;
  --slide-accent: #667eea;
  --slide-muted: #a0a0a0;
  --font-headline: 'Poppins', sans-serif;
  --font-body: 'Inter', sans-serif;
}

/* Light Theme */
.presentation[data-theme="light"] {
  --slide-bg: #ffffff;
  --slide-text: #1a1a2e;
  --slide-accent: #667eea;
  --slide-muted: #666666;
  --font-headline: 'Poppins', sans-serif;
  --font-body: 'Inter', sans-serif;
}
```

---

## 7. Image Generation Pipeline

### 7.1 Pipeline Architecture

```python
@dataclass
class ImageGenerationPipeline:
    def __init__(self, style: str):
        self.style = style
        self.style_config = STYLE_CONFIGS[style]
        self.image_generator = ImageGenerator()
        self.text_renderer = TextRenderer()
        self.compositor = SlideCompositor()

    async def generate_slide(
        self,
        slide_content: SlideContent,
        slide_number: int,
        total_slides: int
    ) -> GeneratedSlide:
        # Step 1: Compose image prompt
        image_prompt = self._compose_prompt(slide_content)

        # Step 2: Generate base image
        base_image = await self.image_generator.generate(
            prompt=image_prompt.prompt,
            negative_prompt=image_prompt.negative_prompt,
            style_modifiers=self.style_config.modifiers,
            width=1920,
            height=1080,
            seed=slide_number * 1000  # Reproducible
        )

        # Step 3: Render text overlays
        text_layers = self.text_renderer.render(...)

        # Step 4: Composite final image
        final_image = self.compositor.composite(...)

        return GeneratedSlide(...)
```

---

## 8. Content Processing

### 8.1 Content Constraints

```python
CONSTRAINTS = {
    'max_headline_words': 10,
    'max_subheadline_words': 15,
    'max_bullet_points': 6,
    'max_words_per_bullet': 25,
    'max_quote_words': 50,
}
```

### 8.2 Slide Types

- `title` - Title slide (must be first)
- `content` - Standard content slide
- `section` - Section divider
- `data` - Data visualization with charts
- `quote` - Quote/testimonial
- `image` - Image-focused slide
- `comparison` - Side-by-side comparison
- `timeline` - Timeline/roadmap
- `conclusion` - Conclusion/CTA (should be last)

---

## 9. Rendering Engine

### 9.1 Image Dimensions

| Aspect Ratio | Width | Height |
|--------------|-------|--------|
| 16:9 | 1920 | 1080 |
| 4:3 | 1920 | 1440 |
| 1:1 | 1080 | 1080 |

---

## 10. API Contracts

### 10.1 Slide Generation Request

```typescript
interface SlideGenerationRequest {
  content_file_path: string;
  slide_count: number;
  generate_mode: 'html' | 'image';
  style?: string;
  theme?: 'dark' | 'light';
  aspect_ratio?: '16:9' | '4:3' | '1:1';
  brand_colors?: string[];
  font_family?: string;
  include_speaker_notes?: boolean;
  export_formats?: ('pdf' | 'pptx')[];
}
```

### 10.2 Slide Generation Response

```typescript
interface SlideGenerationResponse {
  version_id: string;
  uri: string;  // manus-slides://{version_id}
  slides: Slide[];
  metadata: {
    generate_mode: string;
    style?: string;
    theme: string;
    slide_count: number;
    created_at: string;
  };
  export_urls?: {
    pdf?: string;
    pptx?: string;
  };
}
```

---

**End of Specification**
