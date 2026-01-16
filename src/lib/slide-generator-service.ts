import PptxGenJS from 'pptxgenjs';
import { 
  SlideContent, 
  SlideStyleName, 
  ChartData,
  StyleColors 
} from '@/types/slides';
import { SLIDE_STYLES, SWISSBRAIN_THEME_COLORS, getStyleConfig } from '@/lib/slide-styles';

// =============================================
// PPTX GENERATOR SERVICE
// =============================================

interface PPTXGeneratorOptions {
  title: string;
  subtitle?: string;
  author?: string;
  company?: string;
  style?: SlideStyleName;
}

export async function generateStyledPPTX(
  slides: SlideContent[],
  options: PPTXGeneratorOptions
): Promise<Blob> {
  const pptx = new PptxGenJS();
  const styleConfig = options.style ? getStyleConfig(options.style) : null;
  
  // Use style colors or SwissBrAIn defaults
  const colors = styleConfig?.colors || SWISSBRAIN_THEME_COLORS;
  
  // Set presentation properties
  pptx.author = options.author || 'SwissBrAIn AI';
  pptx.company = options.company || 'SwissBrAIn';
  pptx.title = options.title;
  pptx.subject = options.subtitle || '';
  pptx.layout = 'LAYOUT_16x9';
  
  // Define master slide with branding
  pptx.defineSlideMaster({
    title: 'SWISSBRAIN_MASTER',
    background: { color: colors.background.replace('#', '') },
    objects: [
      // Bottom accent bar
      {
        rect: {
          x: 0,
          y: 5.2,
          w: 10,
          h: 0.2,
          fill: { color: colors.primary.replace('#', '') },
        },
      },
    ],
  });
  
  // Generate each slide
  for (let i = 0; i < slides.length; i++) {
    const slideContent = slides[i];
    const pptxSlide = pptx.addSlide({ masterName: 'SWISSBRAIN_MASTER' });
    
    // Add slide number
    pptxSlide.addText(`${i + 1}`, {
      x: 9.3,
      y: 5.3,
      w: 0.5,
      h: 0.2,
      fontSize: 8,
      color: colors.muted.replace('#', ''),
      align: 'right',
    });
    
    switch (slideContent.slideType) {
      case 'title':
        renderTitleSlide(pptxSlide, slideContent, colors);
        break;
      case 'section':
        renderSectionSlide(pptxSlide, slideContent, colors);
        break;
      case 'data':
        renderDataSlide(pptxSlide, slideContent, colors);
        break;
      case 'quote':
        renderQuoteSlide(pptxSlide, slideContent, colors);
        break;
      case 'comparison':
        renderComparisonSlide(pptxSlide, slideContent, colors);
        break;
      case 'timeline':
        renderTimelineSlide(pptxSlide, slideContent, colors);
        break;
      case 'conclusion':
        renderConclusionSlide(pptxSlide, slideContent, colors);
        break;
      case 'image':
        renderImageSlide(pptxSlide, slideContent, colors);
        break;
      default:
        renderContentSlide(pptxSlide, slideContent, colors);
    }
    
    // Add speaker notes if present
    if (slideContent.speakerNotes) {
      pptxSlide.addNotes(slideContent.speakerNotes);
    }
  }
  
  // Generate and return blob
  const pptxBlob = await pptx.write({ outputType: 'blob' }) as Blob;
  return pptxBlob;
}

function renderTitleSlide(slide: PptxGenJS.Slide, content: SlideContent, colors: StyleColors) {
  // Main title - large, centered
  slide.addText(content.headline, {
    x: 0.5,
    y: 2,
    w: 9,
    h: 1.5,
    fontSize: 54,
    bold: true,
    color: colors.primary.replace('#', ''),
    align: 'center',
    fontFace: 'Arial',
  });
  
  // Subtitle
  if (content.subheadline) {
    slide.addText(content.subheadline, {
      x: 0.5,
      y: 3.5,
      w: 9,
      h: 0.75,
      fontSize: 28,
      color: colors.muted.replace('#', ''),
      align: 'center',
      fontFace: 'Arial',
    });
  }
}

function renderSectionSlide(slide: PptxGenJS.Slide, content: SlideContent, colors: StyleColors) {
  // Full-color background for section dividers
  slide.background = { color: colors.primary.replace('#', '') };
  
  slide.addText(content.headline, {
    x: 0.5,
    y: 2,
    w: 9,
    h: 1,
    fontSize: 48,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    fontFace: 'Arial',
  });
  
  if (content.subheadline) {
    slide.addText(content.subheadline, {
      x: 0.5,
      y: 3.2,
      w: 9,
      h: 0.5,
      fontSize: 24,
      color: 'FFFFFF',
      align: 'center',
      fontFace: 'Arial',
    });
  }
}

function renderContentSlide(slide: PptxGenJS.Slide, content: SlideContent, colors: StyleColors) {
  // Headline
  slide.addText(content.headline, {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.8,
    fontSize: 36,
    bold: true,
    color: colors.primary.replace('#', ''),
    fontFace: 'Arial',
  });
  
  // Subheadline
  if (content.subheadline) {
    slide.addText(content.subheadline, {
      x: 0.5,
      y: 1.3,
      w: 9,
      h: 0.5,
      fontSize: 20,
      color: colors.muted.replace('#', ''),
      fontFace: 'Arial',
    });
  }
  
  // Body bullet points
  if (content.bodyText && content.bodyText.length > 0) {
    const bulletText = content.bodyText.map(text => ({
      text,
      options: {
        bullet: { type: 'bullet' as const, color: colors.primary.replace('#', '') },
        fontSize: 18,
        color: colors.text.replace('#', ''),
        fontFace: 'Arial',
        paraSpaceAfter: 12,
      },
    }));
    
    slide.addText(bulletText, {
      x: 0.5,
      y: 2,
      w: 9,
      h: 3,
      valign: 'top',
    });
  }
}

function renderDataSlide(slide: PptxGenJS.Slide, content: SlideContent, colors: StyleColors) {
  // Headline
  slide.addText(content.headline, {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.8,
    fontSize: 32,
    bold: true,
    color: colors.primary.replace('#', ''),
    fontFace: 'Arial',
  });
  
  // Chart
  if (content.data) {
    const chartType = pptxChartType(content.data.type);
    const chartData = convertToChartData(content.data);
    
    slide.addChart(chartType, chartData, {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 3.5,
      showLegend: true,
      legendPos: 'b',
      chartColors: [
        colors.primary.replace('#', ''),
        colors.secondary.replace('#', ''),
        colors.accent.replace('#', ''),
      ],
    });
  }
}

function renderQuoteSlide(slide: PptxGenJS.Slide, content: SlideContent, colors: StyleColors) {
  // Large opening quote
  slide.addText('"', {
    x: 0.3,
    y: 1.5,
    w: 1,
    h: 1.5,
    fontSize: 120,
    color: colors.accent.replace('#', ''),
    fontFace: 'Arial',
    bold: true,
  });
  
  // Quote text
  slide.addText(content.quote || content.headline, {
    x: 1,
    y: 2,
    w: 8,
    h: 2,
    fontSize: 32,
    color: colors.text.replace('#', ''),
    fontFace: 'Arial',
    align: 'center',
    valign: 'middle',
  });
  
  // Attribution
  if (content.quoteAttribution || content.subheadline) {
    slide.addText(`— ${content.quoteAttribution || content.subheadline}`, {
      x: 1,
      y: 4.2,
      w: 8,
      h: 0.5,
      fontSize: 18,
      color: colors.muted.replace('#', ''),
      fontFace: 'Arial',
      align: 'right',
    });
  }
}

function renderComparisonSlide(slide: PptxGenJS.Slide, content: SlideContent, colors: StyleColors) {
  // Headline
  slide.addText(content.headline, {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.8,
    fontSize: 32,
    bold: true,
    color: colors.primary.replace('#', ''),
    fontFace: 'Arial',
  });
  
  // Divider line
  slide.addShape('line', {
    x: 5,
    y: 1.5,
    w: 0,
    h: 3.5,
    line: { color: colors.muted.replace('#', ''), width: 1 },
  });
  
  // Left column
  if (content.bodyText && content.bodyText.length > 0) {
    const leftItems = content.bodyText.slice(0, Math.ceil(content.bodyText.length / 2));
    const leftText = leftItems.map(text => ({
      text,
      options: {
        bullet: { type: 'bullet' as const, color: colors.primary.replace('#', '') },
        fontSize: 16,
        color: colors.text.replace('#', ''),
        fontFace: 'Arial',
        paraSpaceAfter: 10,
      },
    }));
    
    slide.addText(leftText, {
      x: 0.5,
      y: 1.5,
      w: 4.3,
      h: 3.5,
      valign: 'top',
    });
    
    // Right column
    const rightItems = content.bodyText.slice(Math.ceil(content.bodyText.length / 2));
    const rightText = rightItems.map(text => ({
      text,
      options: {
        bullet: { type: 'bullet' as const, color: colors.secondary.replace('#', '') },
        fontSize: 16,
        color: colors.text.replace('#', ''),
        fontFace: 'Arial',
        paraSpaceAfter: 10,
      },
    }));
    
    slide.addText(rightText, {
      x: 5.2,
      y: 1.5,
      w: 4.3,
      h: 3.5,
      valign: 'top',
    });
  }
}

function renderTimelineSlide(slide: PptxGenJS.Slide, content: SlideContent, colors: StyleColors) {
  // Headline
  slide.addText(content.headline, {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.6,
    fontSize: 32,
    bold: true,
    color: colors.primary.replace('#', ''),
    fontFace: 'Arial',
  });
  
  // Timeline line
  slide.addShape('line', {
    x: 0.5,
    y: 2.8,
    w: 9,
    h: 0,
    line: { color: colors.primary.replace('#', ''), width: 3 },
  });
  
  // Timeline points
  if (content.bodyText && content.bodyText.length > 0) {
    const pointCount = Math.min(content.bodyText.length, 5);
    const spacing = 9 / (pointCount + 1);
    
    content.bodyText.slice(0, pointCount).forEach((text, idx) => {
      const x = 0.5 + spacing * (idx + 1);
      
      // Circle marker
      slide.addShape('ellipse', {
        x: x - 0.15,
        y: 2.65,
        w: 0.3,
        h: 0.3,
        fill: { color: colors.primary.replace('#', '') },
      });
      
      // Label
      slide.addText(text, {
        x: x - 0.8,
        y: idx % 2 === 0 ? 1.6 : 3.2,
        w: 1.6,
        h: 0.8,
        fontSize: 12,
        color: colors.text.replace('#', ''),
        fontFace: 'Arial',
        align: 'center',
        valign: 'middle',
      });
    });
  }
}

function renderConclusionSlide(slide: PptxGenJS.Slide, content: SlideContent, colors: StyleColors) {
  // Large headline
  slide.addText(content.headline, {
    x: 0.5,
    y: 1.8,
    w: 9,
    h: 1.2,
    fontSize: 48,
    bold: true,
    color: colors.primary.replace('#', ''),
    align: 'center',
    fontFace: 'Arial',
  });
  
  // Contact/CTA
  if (content.bodyText && content.bodyText.length > 0) {
    slide.addText(content.bodyText.join('\n'), {
      x: 0.5,
      y: 3.2,
      w: 9,
      h: 1.5,
      fontSize: 20,
      color: colors.text.replace('#', ''),
      align: 'center',
      fontFace: 'Arial',
    });
  }
}

function renderImageSlide(slide: PptxGenJS.Slide, content: SlideContent, colors: StyleColors) {
  // Headline
  slide.addText(content.headline, {
    x: 0.5,
    y: 0.5,
    w: 9,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: colors.primary.replace('#', ''),
    fontFace: 'Arial',
  });
  
  // Image or placeholder
  if (content.imageUrl) {
    try {
      slide.addImage({
        path: content.imageUrl,
        x: 1,
        y: 1.3,
        w: 8,
        h: 3.5,
      });
    } catch {
      // Placeholder if image fails
      renderImagePlaceholder(slide, colors);
    }
  } else {
    renderImagePlaceholder(slide, colors);
  }
}

function renderImagePlaceholder(slide: PptxGenJS.Slide, colors: StyleColors) {
  slide.addShape('rect', {
    x: 1,
    y: 1.3,
    w: 8,
    h: 3.5,
    fill: { color: colors.muted.replace('#', ''), transparency: 80 },
    line: { color: colors.primary.replace('#', ''), width: 1, dashType: 'dash' },
  });
  
  slide.addText('Image Placeholder', {
    x: 1,
    y: 2.8,
    w: 8,
    h: 0.5,
    fontSize: 16,
    color: colors.muted.replace('#', ''),
    align: 'center',
    fontFace: 'Arial',
  });
}

function pptxChartType(type: string): PptxGenJS.CHART_NAME {
  const typeMap: Record<string, PptxGenJS.CHART_NAME> = {
    bar: 'bar',
    line: 'line',
    pie: 'pie',
    doughnut: 'doughnut',
    radar: 'radar',
    scatter: 'scatter',
  };
  return typeMap[type] || 'bar';
}

function convertToChartData(data: ChartData): PptxGenJS.OptsChartData[] {
  return data.datasets.map(ds => ({
    name: ds.label,
    labels: data.labels,
    values: ds.data,
  }));
}

// =============================================
// HTML GENERATOR
// =============================================

export function generateHTMLSlides(
  slides: SlideContent[],
  options: PPTXGeneratorOptions
): string {
  const styleConfig = options.style ? getStyleConfig(options.style) : null;
  const colors = styleConfig?.colors || SWISSBRAIN_THEME_COLORS;
  
  const slidesHTML = slides.map((slide, idx) => 
    generateSlideHTML(slide, idx + 1, slides.length, colors)
  ).join('\n');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --slide-bg: ${colors.background};
      --slide-primary: ${colors.primary};
      --slide-secondary: ${colors.secondary};
      --slide-accent: ${colors.accent};
      --slide-text: ${colors.text};
      --slide-muted: ${colors.muted};
    }
    
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Inter', sans-serif;
      background: #1a1a1a;
      color: var(--slide-text);
    }
    
    .presentation {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .slide {
      aspect-ratio: 16 / 9;
      background: var(--slide-bg);
      border-radius: 8px;
      padding: 48px 64px;
      margin-bottom: 24px;
      position: relative;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      display: flex;
      flex-direction: column;
    }
    
    .slide-footer {
      position: absolute;
      bottom: 16px;
      left: 64px;
      right: 64px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--slide-muted);
      border-top: 2px solid var(--slide-primary);
      padding-top: 8px;
    }
    
    .headline {
      font-family: 'Playfair Display', serif;
      font-size: clamp(28px, 4vw, 48px);
      font-weight: 700;
      color: var(--slide-primary);
      margin-bottom: 16px;
    }
    
    .subheadline {
      font-size: clamp(16px, 2vw, 24px);
      color: var(--slide-muted);
      margin-bottom: 24px;
    }
    
    .body-content {
      flex: 1;
      font-size: clamp(14px, 1.5vw, 20px);
      line-height: 1.6;
    }
    
    .bullet-list {
      list-style: none;
      padding-left: 0;
    }
    
    .bullet-list li {
      position: relative;
      padding-left: 28px;
      margin-bottom: 12px;
    }
    
    .bullet-list li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 10px;
      width: 8px;
      height: 8px;
      background: var(--slide-primary);
      border-radius: 50%;
    }
    
    .slide-title {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    
    .slide-title .headline {
      font-size: clamp(36px, 5vw, 64px);
    }
    
    .slide-section {
      background: var(--slide-primary);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    
    .slide-section .headline,
    .slide-section .subheadline {
      color: white;
    }
  </style>
</head>
<body>
  <div class="presentation">
    ${slidesHTML}
  </div>
</body>
</html>`;
}

function generateSlideHTML(
  slide: SlideContent,
  slideNumber: number,
  totalSlides: number,
  colors: StyleColors
): string {
  const slideClass = `slide slide-${slide.slideType}`;
  
  let content = '';
  
  switch (slide.slideType) {
    case 'title':
      content = `
        <h1 class="headline">${slide.headline}</h1>
        ${slide.subheadline ? `<p class="subheadline">${slide.subheadline}</p>` : ''}
      `;
      break;
      
    case 'section':
      content = `
        <h2 class="headline">${slide.headline}</h2>
        ${slide.subheadline ? `<p class="subheadline">${slide.subheadline}</p>` : ''}
      `;
      break;
      
    default:
      content = `
        <h2 class="headline">${slide.headline}</h2>
        ${slide.subheadline ? `<p class="subheadline">${slide.subheadline}</p>` : ''}
        <div class="body-content">
          ${slide.bodyText && slide.bodyText.length > 0 ? `
            <ul class="bullet-list">
              ${slide.bodyText.map(text => `<li>${text}</li>`).join('\n')}
            </ul>
          ` : ''}
        </div>
      `;
  }
  
  return `
    <div class="${slideClass}">
      ${content}
      <div class="slide-footer">
        <span>Generated by SwissBrAIn</span>
        <span>${slideNumber} / ${totalSlides}</span>
      </div>
    </div>
  `;
}

// =============================================
// DOWNLOAD UTILITIES
// =============================================

export function downloadStyledPPTX(blob: Blob, filename: string = 'presentation.pptx'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadHTML(html: string, filename: string = 'presentation.html'): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
