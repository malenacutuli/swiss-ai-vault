import PptxGenJS from 'pptxgenjs';

export interface SlideData {
  number?: number;
  layout?: 'title' | 'content' | 'section' | 'two-column';
  title: string;
  subtitle?: string;
  bullets?: string[];
  content?: string | string[];
  notes?: string;
  imageUrl?: string;
}

export interface PresentationData {
  title: string;
  slides: SlideData[];
}

export async function generatePptxBlob(data: PresentationData): Promise<Blob> {
  const pptx = new PptxGenJS();
  
  // Metadata
  pptx.author = 'SwissVault Studio';
  pptx.title = data.title;
  pptx.company = 'SwissVault';
  
  // Master slides with SwissVault branding
  pptx.defineSlideMaster({
    title: 'SWISS_TITLE',
    background: { color: 'FFFFFF' },
    objects: [
      { rect: { x: 0, y: 0, w: '100%', h: 0.6, fill: { color: '1D4E5F' } } },
    ]
  });
  
  pptx.defineSlideMaster({
    title: 'SWISS_CONTENT',
    background: { color: 'FFFFFF' },
    objects: [
      { rect: { x: 0, y: 0, w: '100%', h: 0.5, fill: { color: '1D4E5F' } } },
    ]
  });

  for (let i = 0; i < data.slides.length; i++) {
    const slideData = data.slides[i];
    const isTitle = slideData.layout === 'title' || i === 0;
    const slide = pptx.addSlide({ masterName: isTitle ? 'SWISS_TITLE' : 'SWISS_CONTENT' });
    
    if (isTitle) {
      // Title slide layout
      slide.addText(slideData.title, {
        x: 0.5, y: 2.5, w: 9, h: 1.2,
        fontSize: 40, fontFace: 'Arial', color: '1D4E5F',
        bold: true, align: 'center'
      });
      
      if (slideData.subtitle) {
        slide.addText(slideData.subtitle, {
          x: 0.5, y: 3.8, w: 9, h: 0.6,
          fontSize: 20, fontFace: 'Arial', color: '6B7280',
          align: 'center'
        });
      }
    } else {
      // Content slide layout
      slide.addText(slideData.title, {
        x: 0.5, y: 0.8, w: 9, h: 0.7,
        fontSize: 28, fontFace: 'Arial', color: '1D4E5F',
        bold: true
      });
      
      // Get bullets from various formats
      let bullets: string[] = [];
      if (slideData.bullets && slideData.bullets.length > 0) {
        bullets = slideData.bullets;
      } else if (typeof slideData.content === 'string') {
        bullets = slideData.content.split('\n').filter(Boolean);
      } else if (Array.isArray(slideData.content)) {
        bullets = slideData.content;
      }
      
      if (bullets.length > 0) {
        const bulletText = bullets.map(b => ({ 
          text: b.replace(/^[•\-]\s*/, ''), // Remove existing bullet prefixes
          options: { bullet: { type: 'bullet' as const, color: '1D4E5F' } } 
        }));
        
        slide.addText(bulletText, {
          x: 0.5, y: 1.7, w: 9, h: 4.5,
          fontSize: 16, fontFace: 'Arial', color: '374151',
          valign: 'top', lineSpacing: 26
        });
      }
    }
    
    // Speaker notes
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  }
  
  return await pptx.write({ outputType: 'blob' }) as Blob;
}

export async function downloadPptx(data: PresentationData, filename?: string): Promise<void> {
  const blob = await generatePptxBlob(data);
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${data.title.replace(/[^a-z0-9]/gi, '_')}.pptx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
