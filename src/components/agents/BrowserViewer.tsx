import React, { useState } from 'react';
import { 
  Globe, 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  Camera,
  ChevronDown,
  ExternalLink,
  Loader2,
  AlertCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface BrowserViewerProps {
  currentUrl?: string | null;
  pageTitle?: string | null;
  screenshot?: string | null;
  isLoading?: boolean;
  isConnected?: boolean;
  error?: string | null;
  onNavigate?: (url: string) => void;
  onBack?: () => void;
  onForward?: () => void;
  onRefresh?: () => void;
  onScreenshot?: () => void;
  className?: string;
  readOnly?: boolean;
}

export function BrowserViewer({
  currentUrl,
  pageTitle,
  screenshot,
  isLoading = false,
  isConnected = false,
  error,
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  onScreenshot,
  className,
  readOnly = false,
}: BrowserViewerProps) {
  const [urlInput, setUrlInput] = useState(currentUrl || '');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleNavigate = () => {
    if (!urlInput || !onNavigate) return;
    
    let url = urlInput;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    onNavigate(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate();
    }
  };

  return (
    <div className={cn(
      'flex flex-col bg-background border border-border rounded-lg overflow-hidden',
      isFullscreen && 'fixed inset-4 z-50 shadow-2xl',
      className
    )}>
      {/* Browser toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onBack}
            disabled={isLoading || readOnly || !onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onForward}
            disabled={isLoading || readOnly || !onForward}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onRefresh}
            disabled={isLoading || readOnly || !onRefresh}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* URL bar */}
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter URL..."
              className="pl-9 h-8 text-sm"
              disabled={readOnly}
            />
          </div>
          
          {!readOnly && (
            <Button
              size="sm"
              onClick={handleNavigate}
              disabled={isLoading || !urlInput}
            >
              Go
            </Button>
          )}
        </div>

        {/* Status and actions */}
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? 'default' : 'secondary'} className="text-xs">
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>

          {onScreenshot && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={onScreenshot}
              disabled={isLoading || !isConnected}
            >
              <Camera className="h-4 w-4" />
            </Button>
          )}

          {currentUrl && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => window.open(currentUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Page title bar */}
      {pageTitle && (
        <div className="px-3 py-1.5 bg-muted/30 border-b border-border text-sm text-muted-foreground truncate">
          {pageTitle}
        </div>
      )}

      {/* Browser viewport */}
      <div className="flex-1 relative bg-white min-h-[400px]">
        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center p-6">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Screenshot display */}
        {screenshot ? (
          <ScrollArea className="h-full">
            <img
              src={screenshot.startsWith('data:') ? screenshot : `data:image/png;base64,${screenshot}`}
              alt="Browser screenshot"
              className="w-full"
            />
          </ScrollArea>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Globe className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-sm">
                {isConnected 
                  ? 'Navigate to a URL to view content' 
                  : 'Browser not connected'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
