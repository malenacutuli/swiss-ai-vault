import { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export interface PDFHighlight {
  page: number;
  bbox?: { x: number; y: number; width: number; height: number };
}

interface PDFViewerWithHighlightProps {
  url: string;
  activeHighlight?: PDFHighlight;
  onPageChange?: (page: number) => void;
  title?: string;
}

export function PDFViewerWithHighlight({
  url,
  activeHighlight,
  onPageChange,
  title,
}: PDFViewerWithHighlightProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle document load success
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
  };

  // Handle document load error
  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    setError('Failed to load PDF');
    setIsLoading(false);
  };

  // Auto-scroll to highlighted page when highlight changes
  useEffect(() => {
    if (activeHighlight?.page && pageRefs.current[activeHighlight.page]) {
      pageRefs.current[activeHighlight.page]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      setCurrentPage(activeHighlight.page);
    }
  }, [activeHighlight]);

  // Navigation functions
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
      pageRefs.current[page]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onPageChange?.(page);
    }
  }, [numPages, onPageChange]);

  const previousPage = () => goToPage(currentPage - 1);
  const nextPage = () => goToPage(currentPage + 1);

  // Zoom functions
  const zoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));

  // Download function
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = title || 'document.pdf';
    link.click();
  };

  // Track current page on scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;

    let closestPage = 1;
    let closestDistance = Infinity;

    Object.entries(pageRefs.current).forEach(([pageNum, ref]) => {
      if (ref) {
        const rect = ref.getBoundingClientRect();
        const pageCenter = rect.top + rect.height / 2;
        const distance = Math.abs(pageCenter - containerCenter);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = parseInt(pageNum, 10);
        }
      }
    });

    if (closestPage !== currentPage) {
      setCurrentPage(closestPage);
    }
  }, [currentPage]);

  if (error) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="text-center py-8">
          <p className="text-destructive">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={previousPage}
            disabled={currentPage <= 1}
            className="h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <span className="text-sm text-muted-foreground min-w-[80px] text-center">
            {currentPage} / {numPages || '—'}
          </span>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={nextPage}
            disabled={currentPage >= numPages}
            className="h-8 w-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="h-8 w-8"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <span className="text-sm text-muted-foreground min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={scale >= 3}
            className="h-8 w-8"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          <div className="w-px h-4 bg-border mx-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="h-8 w-8"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* PDF Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/50 p-4"
        onScroll={handleScroll}
      >
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="flex flex-col items-center gap-4"
        >
          {Array.from(new Array(numPages), (_, index) => {
            const pageNumber = index + 1;
            const isActivePage = activeHighlight?.page === pageNumber;
            
            return (
              <div
                key={`page_${pageNumber}`}
                ref={(el) => { pageRefs.current[pageNumber] = el; }}
                className={cn(
                  'relative bg-white shadow-lg rounded-sm',
                  isActivePage && 'ring-2 ring-primary ring-offset-2'
                )}
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />

                {/* BBOX Highlight Overlay */}
                {isActivePage && activeHighlight?.bbox && (
                  <div
                    className={cn(
                      'absolute bg-amber-400/40 border-2 border-amber-500 rounded-sm',
                      'animate-pulse pointer-events-none'
                    )}
                    style={{
                      left: `${activeHighlight.bbox.x}%`,
                      top: `${activeHighlight.bbox.y}%`,
                      width: `${activeHighlight.bbox.width}%`,
                      height: `${activeHighlight.bbox.height}%`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </Document>
      </div>
    </div>
  );
}
