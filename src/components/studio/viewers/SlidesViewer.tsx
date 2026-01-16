import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Maximize2,
  Grid3X3,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StylePreset, getStyleConfig } from '@/lib/stylePresets';
import PptxGenJS from 'pptxgenjs';

interface Slide {
  id: string;
  title: string;
  content: string;
  notes?: string;
  imageUrl?: string;
}

interface SlidesViewerProps {
  slides: Slide[];
  title?: string;
  style?: StylePreset;
  onDownload?: () => void;
}

export function SlidesViewer({ slides, title, style = 'corporate', onDownload }: SlidesViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'full'>('grid');
  const [showNotes, setShowNotes] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const styleConfig = getStyleConfig(style);
  const currentSlide = slides[currentIndex];

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleThumbnailClick = (index: number) => {
    setCurrentIndex(index);
    setViewMode('full');
  };

  // Generate and download styled PPTX
  const handleStyledDownload = async () => {
    setIsDownloading(true);
    try {
      const pptx = new PptxGenJS();
      pptx.title = title || 'Presentation';
      pptx.author = 'SwissVault Studio';

      const colors = styleConfig.slides.pptxColors;

      // Define master slide
      pptx.defineSlideMaster({
        title: 'STYLED_MASTER',
        background: { color: colors.bg },
        objects: [
          { rect: { x: 0, y: 0, w: 0.15, h: '100%', fill: { color: colors.accent } } },
        ],
      });

      slides.forEach((slide, index) => {
        const pptxSlide = pptx.addSlide({ masterName: 'STYLED_MASTER' });

        // Title
        pptxSlide.addText(slide.title, {
          x: 0.5,
          y: index === 0 ? 2 : 0.5,
          w: 9,
          h: index === 0 ? 1.5 : 0.8,
          fontSize: index === 0 ? 54 : 36,
          bold: true,
          color: colors.title,
        });

        // Content
        if (slide.content) {
          const lines = slide.content.split('\n').filter(Boolean);
          const bullets = lines.map(line => ({
            text: line.replace(/^[•\-]\s*/, ''),
            options: { bullet: true },
          }));

          pptxSlide.addText(bullets, {
            x: 0.5,
            y: index === 0 ? 3.5 : 1.8,
            w: 9,
            h: 4,
            fontSize: 18,
            color: colors.body,
            valign: 'top',
          });
        }

        // Notes
        if (slide.notes) {
          pptxSlide.addNotes(slide.notes);
        }
      });

      const fileName = `${(title || 'Presentation').replace(/\s+/g, '_')}_${style}.pptx`;
      await pptx.writeFile({ fileName });
    } catch (error) {
      console.error('PPTX generation error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (slides.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground">No slides available.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          {title && <h3 className="text-lg font-medium text-foreground">{title}</h3>}
          <span className="text-sm text-muted-foreground">{slides.length} slides</span>
          <span 
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ 
              backgroundColor: styleConfig.colors.primary + '20',
              color: styleConfig.colors.primary 
            }}
          >
            {styleConfig.name.split(' ')[0]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode(viewMode === 'grid' ? 'full' : 'grid')}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            {viewMode === 'grid' ? <Maximize2 className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleStyledDownload}
            disabled={isDownloading}
            className="h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Download className="w-4 h-4 mr-2" />
            {isDownloading ? 'Generating...' : 'Download .pptx'}
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        /* Thumbnail Grid */
        <div className="p-4 grid grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => handleThumbnailClick(index)}
              className={cn(
                'aspect-video rounded-lg border overflow-hidden transition-all hover:scale-105',
                styleConfig.slides.bg,
                index === currentIndex
                  ? 'ring-2 ring-offset-2'
                  : 'hover:opacity-90'
              )}
              style={{ 
                borderColor: index === currentIndex ? styleConfig.colors.primary : 'transparent',
                ['--tw-ring-color' as any]: styleConfig.colors.primary 
              }}
            >
              <div className="p-3 h-full flex flex-col">
                <p className={cn('text-xs font-medium truncate', styleConfig.slides.titleClass)}>
                  {slide.title}
                </p>
                <p className={cn('text-[10px] mt-1 line-clamp-2', styleConfig.slides.bulletClass)}>
                  {slide.content}
                </p>
                <span className={cn('mt-auto text-[10px]', styleConfig.slides.subtitleClass)}>
                  {index + 1}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Full View */
        <div className="flex">
          <div className="flex-1">
            {/* Slide Content */}
            <div 
              className={cn(
                'aspect-video m-4 rounded-xl p-8 flex flex-col relative overflow-hidden',
                styleConfig.slides.bg
              )}
            >
              {/* Accent bar */}
              <div 
                className={cn('absolute left-0 top-0 bottom-0 w-1', styleConfig.slides.accent)}
              />
              
              <h2 className={cn('text-2xl font-semibold mb-4', styleConfig.slides.titleClass)}>
                {currentSlide?.title}
              </h2>
              <p className={cn('whitespace-pre-wrap flex-1', styleConfig.slides.bulletClass)}>
                {currentSlide?.content}
              </p>
              {currentSlide?.imageUrl && (
                <img
                  src={currentSlide.imageUrl}
                  alt={currentSlide.title}
                  className="max-h-40 object-contain mt-4 rounded-lg"
                />
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between px-4 pb-4">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {slides.length}
              </span>

              <Button
                variant="ghost"
                onClick={handleNext}
                disabled={currentIndex === slides.length - 1}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>

          {/* Speaker Notes Panel */}
          {showNotes && currentSlide?.notes && (
            <div className="w-72 border-l border-border p-4 bg-muted/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-muted-foreground">Speaker Notes</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNotes(false)}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-foreground/80">{currentSlide.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Notes Toggle (in full view) */}
      {viewMode === 'full' && currentSlide?.notes && !showNotes && (
        <div className="px-4 pb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotes(true)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <FileText className="w-4 h-4 mr-2" />
            Show Notes
          </Button>
        </div>
      )}
    </div>
  );
}
