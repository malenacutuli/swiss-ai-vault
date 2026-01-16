import { SlideContent, SlideType, ChartData } from '@/types/slides';

// =============================================
// SLIDE CONTENT ANALYZER
// =============================================

export interface ContentAnalysis {
  primaryTheme: string;
  suggestedSlideCount: number;
  hasData: boolean;
  hasQuotes: boolean;
  hasImages: boolean;
  keywords: string[];
}

export function analyzeContent(markdown: string): ContentAnalysis {
  const lines = markdown.split('\n');
  let hasData = false;
  let hasQuotes = false;
  let hasImages = false;
  const keywords: string[] = [];
  
  for (const line of lines) {
    if (line.includes('```data') || line.includes('chart') || /\d+%|\$[\d,]+/.test(line)) {
      hasData = true;
    }
    if (line.startsWith('>')) {
      hasQuotes = true;
    }
    if (line.startsWith('![')) {
      hasImages = true;
    }
  }
  
  // Extract keywords from headers
  const headers = lines.filter(l => l.startsWith('#'));
  headers.forEach(h => {
    const words = h.replace(/^#+\s*/, '').toLowerCase().split(/\s+/);
    keywords.push(...words.filter(w => w.length > 3));
  });
  
  // Count sections for slide estimate
  const sectionCount = lines.filter(l => l.startsWith('## ')).length;
  const suggestedSlideCount = Math.max(sectionCount + 2, 5); // +2 for title and conclusion
  
  // Determine primary theme
  const themeKeywords: Record<string, string[]> = {
    technology: ['tech', 'software', 'ai', 'digital', 'data', 'cloud', 'code'],
    business: ['revenue', 'growth', 'market', 'strategy', 'sales', 'profit'],
    education: ['learn', 'teach', 'course', 'student', 'training', 'workshop'],
    creative: ['design', 'art', 'creative', 'visual', 'brand', 'style'],
    science: ['research', 'study', 'experiment', 'hypothesis', 'analysis'],
  };
  
  let primaryTheme = 'general';
  let maxMatches = 0;
  
  for (const [theme, themeWords] of Object.entries(themeKeywords)) {
    const matches = themeWords.filter(w => 
      keywords.some(k => k.includes(w))
    ).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      primaryTheme = theme;
    }
  }
  
  return {
    primaryTheme,
    suggestedSlideCount,
    hasData,
    hasQuotes,
    hasImages,
    keywords: [...new Set(keywords)].slice(0, 10),
  };
}

export function parseMarkdownToSlides(markdown: string): SlideContent[] {
  const slides: SlideContent[] = [];
  let currentSlide: Partial<SlideContent> | null = null;
  let slideNumber = 0;
  
  const lines = markdown.trim().split('\n');
  let inDataBlock = false;
  let dataBlockContent = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // New slide (## heading)
    if (line.startsWith('## ')) {
      if (currentSlide && currentSlide.headline) {
        slides.push(currentSlide as SlideContent);
      }
      slideNumber++;
      const headline = line.substring(3).trim();
      currentSlide = {
        slideNumber,
        headline,
        slideType: inferSlideType(headline),
        bodyText: [],
      };
    }
    // Subheadline (### heading)
    else if (line.startsWith('### ') && currentSlide) {
      currentSlide.subheadline = line.substring(4).trim();
    }
    // Bullet point
    else if (line.startsWith('- ') && currentSlide) {
      if (!currentSlide.bodyText) currentSlide.bodyText = [];
      currentSlide.bodyText.push(line.substring(2).trim());
    }
    // Quote
    else if (line.startsWith('> ') && currentSlide) {
      currentSlide.quote = line.substring(2).trim();
      currentSlide.slideType = 'quote';
    }
    // Data block start
    else if (line.startsWith('```data')) {
      inDataBlock = true;
      dataBlockContent = '';
    }
    // Data block end
    else if (line === '```' && inDataBlock) {
      inDataBlock = false;
      if (currentSlide) {
        try {
          currentSlide.data = JSON.parse(dataBlockContent);
          currentSlide.slideType = 'data';
        } catch (e) {
          console.error('Failed to parse chart data:', e);
        }
      }
    }
    // Inside data block
    else if (inDataBlock) {
      dataBlockContent += line + '\n';
    }
    // Image reference
    else if (line.startsWith('![') && currentSlide) {
      const match = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (match) {
        currentSlide.imageUrl = match[2];
        currentSlide.slideType = 'image';
      }
    }
    // Speaker notes
    else if (line.startsWith('<!-- notes:') && currentSlide) {
      currentSlide.speakerNotes = line.replace('<!-- notes:', '').replace('-->', '').trim();
    }
  }
  
  // Don't forget the last slide
  if (currentSlide && currentSlide.headline) {
    slides.push(currentSlide as SlideContent);
  }
  
  return slides;
}

export function inferSlideType(headline: string): SlideType {
  const headlineLower = headline.toLowerCase();
  
  if (['title', 'welcome', 'introduction', 'about'].some(w => headlineLower.includes(w))) {
    return 'title';
  }
  if (['agenda', 'overview', 'contents', 'outline'].some(w => headlineLower.includes(w))) {
    return 'section';
  }
  if (['data', 'metrics', 'numbers', 'chart', 'statistics', 'results'].some(w => headlineLower.includes(w))) {
    return 'data';
  }
  if (['compare', 'vs', 'versus', 'comparison'].some(w => headlineLower.includes(w))) {
    return 'comparison';
  }
  if (['timeline', 'roadmap', 'history', 'milestones'].some(w => headlineLower.includes(w))) {
    return 'timeline';
  }
  if (['conclusion', 'summary', 'next steps', 'thank', 'questions', 'q&a'].some(w => headlineLower.includes(w))) {
    return 'conclusion';
  }
  
  return 'content';
}

export function generateSlideOutline(topic: string, slideCount: number = 8): string {
  // Generate a basic markdown outline for a presentation
  const outline = `## ${topic}
### A SwissBrAIn Presentation

## Agenda
- Overview of ${topic}
- Key concepts
- Data and insights
- Conclusions

## What is ${topic}?
- Definition and context
- Why it matters
- Historical background

## Key Concepts
- First important point
- Second important point
- Third important point

## Data & Metrics
\`\`\`data
{
  "type": "bar",
  "labels": ["Q1", "Q2", "Q3", "Q4"],
  "datasets": [{
    "label": "Performance",
    "data": [65, 78, 82, 91]
  }]
}
\`\`\`

## Case Study
- Real-world example
- Implementation details
- Results achieved

## Best Practices
- Recommendation 1
- Recommendation 2
- Recommendation 3

## Conclusion
- Key takeaways
- Next steps
- Call to action

## Thank You
### Questions?
`;
  
  return outline;
}

export function extractSpeakerNotes(slides: SlideContent[]): string[] {
  return slides
    .filter(s => s.speakerNotes)
    .map(s => `Slide ${s.slideNumber}: ${s.speakerNotes}`);
}

export function estimateReadingTime(slides: SlideContent[], secondsPerSlide: number = 60): number {
  return slides.length * secondsPerSlide;
}

export function validateSlideContent(slides: SlideContent[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (slides.length === 0) {
    errors.push('No slides found in content');
  }
  
  if (slides.length > 0 && slides[0].slideType !== 'title') {
    errors.push('First slide should be a title slide');
  }
  
  slides.forEach((slide, idx) => {
    if (!slide.headline || slide.headline.trim() === '') {
      errors.push(`Slide ${idx + 1} is missing a headline`);
    }
    
    if (slide.slideType === 'content' && (!slide.bodyText || slide.bodyText.length === 0)) {
      errors.push(`Slide ${idx + 1} (content type) has no body text`);
    }
    
    if (slide.slideType === 'data' && !slide.data) {
      errors.push(`Slide ${idx + 1} (data type) is missing chart data`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
