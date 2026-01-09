import { useState, useRef, useEffect } from 'react';
import { RefreshCw, ExternalLink, Loader2, Globe, Smartphone, Monitor, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DevPreviewProps {
  sandboxId: string;
  previewUrl: string;
  onHMRUpdate?: (latency: number) => void;
}

type ViewportType = 'desktop' | 'tablet' | 'mobile';

const VIEWPORT_SIZES: Record<ViewportType, { width: string; label: string }> = {
  desktop: { width: '100%', label: 'Desktop' },
  tablet: { width: '768px', label: 'Tablet' },
  mobile: { width: '375px', label: 'Mobile' },
};

export function DevPreview({ sandboxId, previewUrl, onHMRUpdate }: DevPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportType>('desktop');
  const [hmrConnected, setHmrConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Simulate HMR connection
  useEffect(() => {
    const timer = setTimeout(() => {
      setHmrConnected(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, [sandboxId]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      setError(null);
      iframeRef.current.src = previewUrl;
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError('Failed to load preview');
  };

  // Simulate HMR update
  const simulateHMRUpdate = () => {
    const latency = Math.floor(Math.random() * 60) + 40; // 40-100ms
    setLastUpdateTime(latency);
    onHMRUpdate?.(latency);
    
    // Flash effect on iframe
    if (iframeRef.current) {
      iframeRef.current.style.opacity = '0.8';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.style.opacity = '1';
        }
      }, 100);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Preview header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-[#F8F9FA]">
        {/* Refresh button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoading}
          className="h-8 w-8 text-gray-600 hover:text-[#1D4E5F] hover:bg-gray-100"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} strokeWidth={1.5} />
        </Button>

        {/* URL Bar */}
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm text-gray-600 font-mono truncate">
          <Globe className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
          <span className="truncate">{previewUrl}</span>
        </div>

        {/* Viewport toggles */}
        <div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-white">
          <button
            onClick={() => setViewport('desktop')}
            className={cn(
              "p-1.5 transition-colors duration-200",
              viewport === 'desktop'
                ? "bg-[#1D4E5F] text-white"
                : "text-gray-500 hover:bg-gray-100"
            )}
            title="Desktop view"
          >
            <Monitor className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setViewport('mobile')}
            className={cn(
              "p-1.5 transition-colors duration-200",
              viewport === 'mobile'
                ? "bg-[#1D4E5F] text-white"
                : "text-gray-500 hover:bg-gray-100"
            )}
            title="Mobile view"
          >
            <Smartphone className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Open in new tab */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.open(previewUrl, '_blank')}
          className="h-8 w-8 text-gray-600 hover:text-[#1D4E5F] hover:bg-gray-100"
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>

      {/* Preview content */}
      <div className="flex-1 relative bg-gray-50 overflow-hidden">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-[#1D4E5F]" strokeWidth={1.5} />
              <span className="text-sm font-medium">Loading preview...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <AlertCircle className="h-8 w-8 text-red-500" strokeWidth={1.5} />
              <span className="text-sm font-medium">{error}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                className="mt-2 border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Try again
              </Button>
            </div>
          </div>
        )}

        {/* Iframe container with viewport sizing */}
        <div 
          className={cn(
            "h-full mx-auto transition-all duration-200 bg-white",
            viewport !== 'desktop' && "border-x border-gray-200 shadow-sm"
          )}
          style={{ 
            width: VIEWPORT_SIZES[viewport].width,
            maxWidth: '100%',
          }}
        >
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0 transition-opacity duration-100"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            title="Development Preview"
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-200 bg-[#F8F9FA] text-xs">
        <div className="flex items-center gap-3">
          {/* HMR Status */}
          <div className="flex items-center gap-1.5">
            <div 
              className={cn(
                "w-2 h-2 rounded-full",
                hmrConnected ? "bg-green-500" : "bg-gray-300"
              )}
            />
            <span className={hmrConnected ? "text-green-700" : "text-gray-500"}>
              {hmrConnected ? 'HMR Connected' : 'Connecting...'}
            </span>
          </div>

          {/* Last update latency */}
          {lastUpdateTime !== null && (
            <div className="flex items-center gap-1 text-gray-500">
              <Zap className="h-3 w-3" strokeWidth={1.5} />
              <span>{lastUpdateTime}ms</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-gray-500">
          <span>{isLoading ? 'Loading...' : 'Ready'}</span>
          <span className="text-gray-300">|</span>
          <span>{VIEWPORT_SIZES[viewport].label}</span>
        </div>
      </div>
    </div>
  );
}
