import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowLeft, ArrowRight, ExternalLink, Camera, Globe, Lock, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface BrowserPreviewProps {
  taskId: string;
  currentUrl?: string;
  currentScreenshot?: string;
  isLoading?: boolean;
  onNavigate?: (url: string) => void;
  onBack?: () => void;
  onForward?: () => void;
  onRefresh?: () => void;
  onScreenshot?: () => void;
  className?: string;
}

interface BrowserUpdate {
  url?: string;
  title?: string;
  screenshot?: string;
  statusCode?: number;
}

export function BrowserPreview({
  taskId,
  currentUrl = '',
  currentScreenshot,
  isLoading = false,
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  onScreenshot,
  className,
}: BrowserPreviewProps) {
  const [screenshot, setScreenshot] = useState<string | null>(currentScreenshot || null);
  const [url, setUrl] = useState(currentUrl);
  const [pageTitle, setPageTitle] = useState<string>('');
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  // Update local state when props change
  useEffect(() => {
    if (currentScreenshot) {
      setScreenshot(currentScreenshot);
    }
  }, [currentScreenshot]);

  useEffect(() => {
    if (currentUrl) {
      setUrl(currentUrl);
      setUrlInput(currentUrl);
    }
  }, [currentUrl]);

  // Subscribe to browser updates via Supabase Realtime
  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(`browser-preview-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'browser_actions',
        },
        (payload) => {
          const action = payload.new as {
            action_type: string;
            result: BrowserUpdate | null;
            screenshot_url: string | null;
          };

          if (action.result) {
            if (action.result.screenshot) {
              setScreenshot(action.result.screenshot);
            }
            if (action.result.url) {
              setUrl(action.result.url);
              setUrlInput(action.result.url);
              setHistory(prev => {
                const newHistory = [...prev.slice(0, historyIndex + 1), action.result!.url!];
                return newHistory;
              });
              setHistoryIndex(prev => prev + 1);
            }
            if (action.result.title) {
              setPageTitle(action.result.title);
            }
            if (action.result.statusCode) {
              setStatusCode(action.result.statusCode);
            }
          }

          if (action.screenshot_url) {
            setScreenshot(action.screenshot_url);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, historyIndex]);

  const handleNavigate = useCallback(() => {
    if (!urlInput.trim()) return;
    
    let normalizedUrl = urlInput.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    onNavigate?.(normalizedUrl);
  }, [urlInput, onNavigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate();
    }
  }, [handleNavigate]);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const getStatusColor = () => {
    if (!statusCode) return 'bg-muted';
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-500';
    if (statusCode >= 300 && statusCode < 400) return 'bg-yellow-500';
    return 'bg-destructive';
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border bg-card overflow-hidden',
        isFullscreen && 'fixed inset-4 z-50',
        className
      )}
    >
      {/* Browser Chrome Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
        {/* Window Controls (decorative) */}
        <div className="flex items-center gap-1.5 mr-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onBack}
            disabled={!canGoBack || isLoading}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onForward}
            disabled={!canGoForward || isLoading}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>

        {/* URL Bar */}
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-background rounded-full border">
          <Lock className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
          <Input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter URL..."
            className="flex-1 h-6 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={!onNavigate}
          />
          {statusCode && (
            <Badge variant="secondary" className={cn('h-5 text-xs', getStatusColor())}>
              {statusCode}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onScreenshot}
            disabled={isLoading}
            title="Take screenshot"
          >
            <Camera className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => url && window.open(url, '_blank')}
            disabled={!url}
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Page Title Bar */}
      {pageTitle && (
        <div className="px-3 py-1.5 bg-muted/30 border-b text-sm truncate">
          {pageTitle}
        </div>
      )}

      {/* Browser Viewport */}
      <div className="relative flex-1 min-h-[400px] bg-background">
        {screenshot ? (
          <img
            src={screenshot.startsWith('data:') ? screenshot : `data:image/png;base64,${screenshot}`}
            alt="Browser screenshot"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                <Globe className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No screenshot available</p>
                <p className="text-xs text-muted-foreground">
                  Browser actions will appear here
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-t text-xs text-muted-foreground">
        <span>{isLoading ? 'Loading...' : 'Ready'}</span>
        <span>{history.length} page{history.length !== 1 ? 's' : ''} visited</span>
      </div>
    </div>
  );
}
