import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Maximize2, FileText, Presentation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SlideContent, SlideStyleName } from '@/types/slides';
import { SLIDE_STYLES, SWISSBRAIN_THEME_COLORS } from '@/lib/slide-styles';

interface SlidePreviewProps {
  slides: SlideContent[];
  currentSlide: number;
  onSlideChange: (index: number) => void;
  style?: SlideStyleName;
  onDownloadPPTX?: () => void;
  onDownloadHTML?: () => void;
  onFullscreen?: () => void;
  isGenerating?: boolean;
}

export function SlidePreview({
  slides,
  currentSlide,
  onSlideChange,
  style,
  onDownloadPPTX,
  onDownloadHTML,
  onFullscreen,
  isGenerating,
}: SlidePreviewProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  
  const colors = style ? SLIDE_STYLES[style].colors : SWISSBRAIN_THEME_COLORS;
  const slide = slides[currentSlide];
  
  const goToSlide = (index: number) => {
    if (index >= 0 && index < slides.length && !isAnimating) {
      setIsAnimating(true);
      onSlideChange(index);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToSlide(currentSlide - 1);
      if (e.key === 'ArrowRight') goToSlide(currentSlide + 1);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, slides.length]);
  
  if (!slide) return null;
  
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            Slide {currentSlide + 1} of {slides.length}
          </span>
          {style && (
            <span 
              className="px-2 py-0.5 text-xs font-medium rounded-full"
              style={{ 
                backgroundColor: `${colors.primary}15`,
                color: colors.primary 
              }}
            >
              {SLIDE_STYLES[style].displayName}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onDownloadPPTX && (
            <button
              onClick={onDownloadPPTX}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#1D4E5F] hover:bg-[#1D4E5F]/10 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              PPTX
            </button>
          )}
          {onDownloadHTML && (
            <button
              onClick={onDownloadHTML}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              HTML
            </button>
          )}
          {onFullscreen && (
            <button
              onClick={onFullscreen}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Slide Preview Area */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="relative max-w-4xl w-full">
          {/* Navigation Arrows */}
          <button
            onClick={() => goToSlide(currentSlide - 1)}
            disabled={currentSlide === 0}
            className={cn(
              'absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 z-10',
              'w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center',
              'hover:bg-gray-50 transition-colors',
              'disabled:opacity-30 disabled:cursor-not-allowed'
            )}
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <button
            onClick={() => goToSlide(currentSlide + 1)}
            disabled={currentSlide === slides.length - 1}
            className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 z-10',
              'w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center',
              'hover:bg-gray-50 transition-colors',
              'disabled:opacity-30 disabled:cursor-not-allowed'
            )}
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          
          {/* Slide Card */}
          <div 
            className={cn(
              'aspect-video rounded-xl shadow-2xl overflow-hidden transition-all duration-300',
              isAnimating && 'scale-[0.98] opacity-80'
            )}
          >
            <SlideRenderer slide={slide} colors={colors} style={style} />
          </div>
        </div>
      </div>
      
      {/* Thumbnail Strip */}
      <div className="border-t border-gray-100 bg-white p-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {slides.map((s, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={cn(
                'flex-shrink-0 w-24 aspect-video rounded-lg overflow-hidden',
                'border-2 transition-all',
                idx === currentSlide
                  ? 'border-[#1D4E5F] shadow-md'
                  : 'border-transparent hover:border-gray-300'
              )}
              style={{ backgroundColor: colors.background }}
            >
              <div className="w-full h-full p-1.5 flex flex-col">
                <div className="h-1 w-3/4 rounded-sm mb-0.5" style={{ backgroundColor: colors.primary }} />
                <div className="h-0.5 w-1/2 rounded-sm" style={{ backgroundColor: colors.muted }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Individual Slide Renderer
function SlideRenderer({ 
  slide, 
  colors, 
  style 
}: { 
  slide: SlideContent; 
  colors: typeof SWISSBRAIN_THEME_COLORS;
  style?: SlideStyleName;
}) {
  const isSectionSlide = slide.slideType === 'section';
  const isTitleSlide = slide.slideType === 'title';
  const bgColor = isSectionSlide ? colors.primary : colors.background;
  const textColor = isSectionSlide ? '#ffffff' : colors.text;
  const headlineColor = isSectionSlide ? '#ffffff' : colors.primary;
  
  return (
    <div 
      className="w-full h-full p-8 flex flex-col relative"
      style={{ backgroundColor: bgColor }}
    >
      {/* Headline */}
      <h2 
        className={cn(
          'font-bold leading-tight',
          isTitleSlide ? 'text-4xl text-center mt-auto' : 'text-2xl',
          isSectionSlide && 'text-center mt-auto'
        )}
        style={{ 
          color: headlineColor,
          fontFamily: "'Playfair Display', serif"
        }}
      >
        {slide.headline}
      </h2>
      
      {/* Subheadline */}
      {slide.subheadline && (
        <p 
          className={cn(
            'mt-2 opacity-70',
            (isTitleSlide || isSectionSlide) ? 'text-center text-lg' : 'text-base'
          )}
          style={{ 
            color: isSectionSlide ? '#ffffff' : colors.muted,
            fontFamily: "'Inter', sans-serif"
          }}
        >
          {slide.subheadline}
        </p>
      )}
      
      {/* Body Content */}
      {slide.bodyText && slide.bodyText.length > 0 && !isTitleSlide && !isSectionSlide && (
        <ul className="mt-6 space-y-3 flex-1">
          {slide.bodyText.map((text, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <div 
                className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                style={{ backgroundColor: colors.primary }}
              />
              <span style={{ color: textColor, fontFamily: "'Inter', sans-serif" }}>
                {text}
              </span>
            </li>
          ))}
        </ul>
      )}
      
      {/* Quote */}
      {slide.slideType === 'quote' && slide.quote && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <p 
            className="text-2xl leading-relaxed"
            style={{ 
              color: textColor,
              fontFamily: "'Playfair Display', serif",
              fontStyle: 'italic'
            }}
          >
            "{slide.quote}"
          </p>
          {slide.quoteAttribution && (
            <p 
              className="mt-4 text-sm"
              style={{ color: colors.muted }}
            >
              — {slide.quoteAttribution}
            </p>
          )}
        </div>
      )}
      
      {/* Spacer for title/section slides */}
      {(isTitleSlide || isSectionSlide) && <div className="mb-auto" />}
      
      {/* Footer */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1"
        style={{ backgroundColor: colors.primary }}
      />
      <div 
        className="absolute bottom-2 left-8 right-8 flex justify-between text-xs"
        style={{ color: isSectionSlide ? 'rgba(255,255,255,0.6)' : colors.muted }}
      >
        <span>SwissBrAIn</span>
        <span>Slide {slide.slideNumber}</span>
      </div>
    </div>
  );
}
