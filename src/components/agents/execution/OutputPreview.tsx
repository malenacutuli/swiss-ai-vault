import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Download, Loader2, FileText, Image, Table, Presentation } from 'lucide-react';
import { useState } from 'react';
import type { TaskOutput } from '@/hooks/useAgentExecution';

interface OutputPreviewProps {
  output: TaskOutput | null;
  isLoading?: boolean;
  className?: string;
}

const typeIcons: Record<string, typeof FileText> = {
  document: FileText,
  image: Image,
  spreadsheet: Table,
  presentation: Presentation,
};

export function OutputPreview({ output, isLoading, className }: OutputPreviewProps) {
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center h-full bg-muted/20 rounded-lg',
        className
      )}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Generating preview...</p>
      </div>
    );
  }

  // Empty state
  if (!output) {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center h-full bg-muted/20 rounded-lg',
        className
      )}>
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">Preview will appear here</p>
      </div>
    );
  }

  const Icon = typeIcons[output.output_type] || FileText;

  return (
    <div className={cn('flex flex-col h-full rounded-lg overflow-hidden border border-border', className)}>
      {/* Preview Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
            {output.file_name}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleZoomOut}
            disabled={zoom <= 50}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{zoom}%</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleZoomIn}
            disabled={zoom >= 200}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          {output.download_url && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 ml-2"
              onClick={() => window.open(output.download_url!, '_blank')}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-auto bg-background p-4">
        {output.preview_url ? (
          output.output_type === 'image' ? (
            <img
              src={output.preview_url}
              alt={output.file_name}
              className="mx-auto max-w-full h-auto rounded"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
            />
          ) : (
            <iframe
              src={output.preview_url}
              className="w-full h-full border-0 rounded"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
              title={output.file_name}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <Icon className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">
              Preview not available
            </p>
            {output.download_url && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-2"
                onClick={() => window.open(output.download_url!, '_blank')}
              >
                <Download className="h-4 w-4" />
                Download to view
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
