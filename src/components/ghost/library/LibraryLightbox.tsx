import { useState, useEffect, useCallback } from 'react';
import { LibraryItem } from '@/pages/GhostLibrary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, 
  ChevronLeft, 
  ChevronRight,
  Star,
  Download,
  Trash2,
  Info,
  Copy,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2
} from '@/icons';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

interface LibraryLightboxProps {
  item: LibraryItem;
  items: LibraryItem[];
  onClose: () => void;
  onNavigate: (item: LibraryItem) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}

export function LibraryLightbox({
  item,
  items,
  onClose,
  onNavigate,
  onToggleFavorite,
  onDelete,
}: LibraryLightboxProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const currentIndex = items.findIndex(i => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(items[currentIndex - 1]);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [hasPrev, currentIndex, items, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      onNavigate(items[currentIndex + 1]);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [hasNext, currentIndex, items, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'i') setShowInfo(prev => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handlePrev, handleNext]);

  const handleDownload = () => {
    if (item.storage_key.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = item.storage_key;
      a.download = item.title || `ghost-${item.content_type}-${item.id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Download started');
    }
  };

  const handleCopyPrompt = () => {
    if (item.prompt) {
      navigator.clipboard.writeText(item.prompt);
      toast.success('Prompt copied to clipboard');
    }
  };

  const handleDelete = () => {
    onDelete(item.id);
    if (hasNext) {
      handleNext();
    } else if (hasPrev) {
      handlePrev();
    } else {
      onClose();
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-sm">
            {currentIndex + 1} / {items.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
          >
            <Star className={`h-4 w-4 ${item.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 hover:bg-white/10 ${showInfo ? 'text-white bg-white/10' : 'text-white/70 hover:text-white'}`}
            onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
          >
            <Info className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Navigation arrows */}
      {hasPrev && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 text-white/70 hover:text-white hover:bg-white/10 z-10"
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}
      {hasNext && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 text-white/70 hover:text-white hover:bg-white/10 z-10"
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Content area */}
      <div 
        className="flex h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main content */}
        <div 
          className={`flex-1 flex items-center justify-center p-16 transition-all ${showInfo ? 'mr-80' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          {item.content_type === 'image' ? (
            <img
              src={item.storage_key}
              alt={item.title || 'Generated image'}
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              }}
              draggable={false}
            />
          ) : (
            <video
              src={item.storage_key}
              controls
              className="max-w-full max-h-full"
              autoPlay
            />
          )}
        </div>

        {/* Info panel */}
        {showInfo && (
          <div 
            className="w-80 bg-background/95 border-l border-border/40 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border/40">
              <h3 className="font-medium">{item.title || 'Untitled'}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </p>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Prompt */}
                {item.prompt && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Prompt
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleCopyPrompt}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm">{item.prompt}</p>
                  </div>
                )}

                {/* Details */}
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                    Details
                  </span>
                  <div className="space-y-2 text-sm">
                    {item.model_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Model</span>
                        <Badge variant="outline">{item.model_id}</Badge>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="capitalize">{item.content_type}</span>
                    </div>
                    {item.width && item.height && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dimensions</span>
                        <span>{item.width} × {item.height}</span>
                      </div>
                    )}
                    {item.duration_seconds && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duration</span>
                        <span>{item.duration_seconds}s</span>
                      </div>
                    )}
                    {item.file_size_bytes && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">File size</span>
                        <span>{formatBytes(item.file_size_bytes)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span>{format(new Date(item.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                      Tags
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="p-4 border-t border-border/40 flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={handleCopyPrompt}
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
              <Button 
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Zoom controls (for images only) */}
      {item.content_type === 'image' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/50 rounded-lg p-1 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => { e.stopPropagation(); setZoom(Math.max(0.5, zoom - 0.25)); }}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-white/70 text-sm w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => { e.stopPropagation(); setZoom(Math.min(3, zoom + 0.25)); }}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            onClick={(e) => { e.stopPropagation(); setZoom(1); setPosition({ x: 0, y: 0 }); }}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
