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
  onDownload?: () => void;
}

export function SlidesViewer({ slides, title, onDownload }: SlidesViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'full'>('grid');
  const [showNotes, setShowNotes] = useState(false);

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

  if (slides.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <p className="text-white/60">No slides available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          {title && <h3 className="text-lg font-medium text-white">{title}</h3>}
          <span className="text-sm text-white/40">{slides.length} slides</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode(viewMode === 'grid' ? 'full' : 'grid')}
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
          >
            {viewMode === 'grid' ? <Maximize2 className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </Button>

          {onDownload && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDownload}
              className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
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
                'aspect-video bg-white/10 rounded-lg border overflow-hidden transition-all hover:scale-105',
                index === currentIndex
                  ? 'border-[#e63946] ring-2 ring-[#e63946]/30'
                  : 'border-white/10 hover:border-white/30'
              )}
            >
              <div className="p-3 h-full flex flex-col">
                <p className="text-xs font-medium text-white truncate">{slide.title}</p>
                <p className="text-[10px] text-white/40 mt-1 line-clamp-2">{slide.content}</p>
                <span className="mt-auto text-[10px] text-white/30">{index + 1}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Full View */
        <div className="flex">
          <div className="flex-1">
            {/* Slide Content */}
            <div className="aspect-video bg-gradient-to-br from-white/10 to-white/5 m-4 rounded-xl p-8 flex flex-col">
              <h2 className="text-2xl font-semibold text-white mb-4">{currentSlide?.title}</h2>
              <p className="text-white/80 whitespace-pre-wrap flex-1">{currentSlide?.content}</p>
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
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              <span className="text-sm text-white/60">
                {currentIndex + 1} / {slides.length}
              </span>

              <Button
                variant="ghost"
                onClick={handleNext}
                disabled={currentIndex === slides.length - 1}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>

          {/* Speaker Notes Panel */}
          {showNotes && currentSlide?.notes && (
            <div className="w-72 border-l border-white/10 p-4 bg-white/5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white/60">Speaker Notes</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNotes(false)}
                  className="h-6 w-6 text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-white/70">{currentSlide.notes}</p>
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
            className="text-white/40 hover:text-white hover:bg-white/10"
          >
            <FileText className="w-4 h-4 mr-2" />
            Show Notes
          </Button>
        </div>
      )}
    </div>
  );
}
