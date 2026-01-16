import { useEffect, useRef } from 'react';
import { X, FileText, ExternalLink, Quote, MapPin, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface SourceSnippet {
  source_id: string;
  source_title: string;
  text: string;
  page_number?: number;
  confidence?: number; // 0-1
  bbox?: { x: number; y: number; width: number; height: number };
}

interface SourceSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  snippets: SourceSnippet[];
  activeNodeTitle?: string;
  onSnippetClick?: (snippet: SourceSnippet) => void;
}

function getConfidenceColor(confidence?: number): { bg: string; text: string; dot: string } {
  if (!confidence) return { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' };
  if (confidence >= 0.9) return { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' };
  if (confidence >= 0.7) return { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' };
  return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' };
}

export function SourceSidebar({
  isOpen,
  onClose,
  snippets,
  activeNodeTitle,
  onSnippetClick,
}: SourceSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/20 z-40 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={cn(
          'fixed top-0 right-0 h-full w-80 bg-[#FDFBF6] shadow-elevated z-50',
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-background border-b border-border">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground truncate">
              Sources
            </h3>
            {activeNodeTitle && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                for "{activeNodeTitle}"
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100%-60px)]">
          <div className="p-4 space-y-3">
            {snippets.length === 0 ? (
              <div className="text-center py-12">
                <Quote className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No source citations found
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click on nodes or citations to view sources
                </p>
              </div>
            ) : (
              snippets.map((snippet, index) => {
                const confidenceColors = getConfidenceColor(snippet.confidence);
                
                return (
                  <button
                    key={`${snippet.source_id}-${index}`}
                    onClick={() => onSnippetClick?.(snippet)}
                    className={cn(
                      'w-full text-left bg-background rounded-lg border border-border',
                      'p-3 transition-all hover:border-primary hover:shadow-md',
                      'group'
                    )}
                  >
                    {/* Source header */}
                    <div className="flex items-start gap-2 mb-2">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {snippet.source_title}
                          </span>
                          {snippet.page_number && (
                            <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground shrink-0">
                              p.{snippet.page_number}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>

                    {/* Quoted text */}
                    <div className="border-l-2 border-primary/40 pl-3 mb-2">
                      <p className="text-sm text-muted-foreground italic line-clamp-4">
                        "{snippet.text}"
                      </p>
                    </div>

                    {/* Footer with confidence */}
                    <div className="flex items-center justify-between">
                      {snippet.confidence !== undefined ? (
                        <div className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs', confidenceColors.bg, confidenceColors.text)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', confidenceColors.dot)} />
                          {Math.round(snippet.confidence * 100)}% match
                        </div>
                      ) : (
                        <div />
                      )}
                      
                      {snippet.bbox && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span>View in document</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
