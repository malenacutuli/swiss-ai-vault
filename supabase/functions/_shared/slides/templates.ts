// supabase/functions/_shared/slides/templates.ts

export interface SlideTemplate {
  id: string;
  name: string;
  layout: 'title' | 'content' | 'two_column' | 'image' | 'chart' | 'bullets' | 'quote';
  placeholders: string[];
}

export const SLIDE_LAYOUTS: SlideTemplate[] = [
  {
    id: 'title_slide',
    name: 'Title Slide',
    layout: 'title',
    placeholders: ['title', 'subtitle', 'author', 'date']
  },
  {
    id: 'content_slide',
    name: 'Content Slide',
    layout: 'content',
    placeholders: ['title', 'body']
  },
  {
    id: 'bullets_slide',
    name: 'Bullet Points',
    layout: 'bullets',
    placeholders: ['title', 'bullets']
  },
  {
    id: 'two_column',
    name: 'Two Columns',
    layout: 'two_column',
    placeholders: ['title', 'left_content', 'right_content']
  },
  {
    id: 'image_slide',
    name: 'Image with Caption',
    layout: 'image',
    placeholders: ['title', 'image_url', 'caption']
  },
  {
    id: 'quote_slide',
    name: 'Quote',
    layout: 'quote',
    placeholders: ['quote', 'attribution']
  }
];

export const THEMES = {
  swiss: {
    primary: '#1D4E5F',
    secondary: '#F8F9FA',
    accent: '#E63946',
    font_heading: 'Playfair Display',
    font_body: 'Inter'
  },
  dark: {
    primary: '#1a1a2e',
    secondary: '#16213e',
    accent: '#0f3460',
    font_heading: 'Montserrat',
    font_body: 'Open Sans'
  },
  corporate: {
    primary: '#003366',
    secondary: '#FFFFFF',
    accent: '#FF6600',
    font_heading: 'Arial',
    font_body: 'Arial'
  },
  minimal: {
    primary: '#000000',
    secondary: '#FFFFFF',
    accent: '#888888',
    font_heading: 'Helvetica',
    font_body: 'Helvetica'
  }
};

export function generateSlidePrompt(title: string, outline: string, slideCount: number, theme: string): string {
  return `Generate a ${slideCount}-slide presentation about "${title}".

Outline: ${outline}

Output format: JSON array of slides, each with:
- layout: one of [title, content, bullets, two_column, quote]
- title: slide title
- content: main content (for content/bullets layouts)
- bullets: array of bullet points (for bullets layout)
- left_content/right_content: (for two_column layout)
- quote/attribution: (for quote layout)

Theme: ${theme}
First slide must be 'title' layout.
Last slide should be summary or call-to-action.

Return ONLY valid JSON array, no markdown.`;
}
