/**
 * Sandbox Preview Component
 * 
 * Displays a live preview of the agent's sandbox environment
 * including dev server output and file browser
 */

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Monitor,
  RefreshCw,
  ExternalLink,
  Maximize2,
  Minimize2,
  Smartphone,
  Tablet,
  Laptop,
  Globe,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SandboxPreviewProps {
  url?: string | null;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

type ViewportSize = 'mobile' | 'tablet' | 'desktop' | 'full';

const VIEWPORT_SIZES: Record<ViewportSize, { width: number; height: number; label: string; icon: React.ReactNode }> = {
  mobile: { width: 375, height: 667, label: 'Mobile', icon: <Smartphone className="w-4 h-4" /> },
  tablet: { width: 768, height: 1024, label: 'Tablet', icon: <Tablet className="w-4 h-4" /> },
  desktop: { width: 1280, height: 800, label: 'Desktop', icon: <Laptop className="w-4 h-4" /> },
  full: { width: 0, height: 0, label: 'Full Width', icon: <Monitor className="w-4 h-4" /> },
};

export function SandboxPreview({
  url,
  isLoading = false,
  error,
  className,
}: SandboxPreviewProps) {
  const [viewport, setViewport] = useState<ViewportSize>('full');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIframeLoading(false);
  };

  // Refresh preview
  const handleRefresh = () => {
    setIframeLoading(true);
    setIframeKey(prev => prev + 1);
  };

  // Open in new tab
  const handleOpenExternal = () => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  // Get viewport style
  const getViewportStyle = (): React.CSSProperties => {
    if (viewport === 'full') {
      return { width: '100%', height: '100%' };
    }
    const size = VIEWPORT_SIZES[viewport];
    return {
      width: `${size.width}px`,
      height: `${size.height}px`,
      maxWidth: '100%',
      maxHeight: '100%',
    };
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#333]",
        isFullscreen && "fixed inset-4 z-50",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-b border-[#333]">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#666]" />
          <span className="text-sm text-[#ccc] font-medium">Preview</span>
          {url && (
            <span className="text-xs text-[#666] truncate max-w-[200px]">
              {new URL(url).hostname}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Viewport selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-[#888] hover:text-white gap-1"
              >
                {VIEWPORT_SIZES[viewport].icon}
                <span className="hidden sm:inline">{VIEWPORT_SIZES[viewport].label}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#222] border-[#333]">
              {Object.entries(VIEWPORT_SIZES).map(([key, value]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setViewport(key as ViewportSize)}
                  className={cn(
                    "text-[#ccc] hover:text-white hover:bg-[#333] gap-2",
                    viewport === key && "bg-[#333]"
                  )}
                >
                  {value.icon}
                  <span>{value.label}</span>
                  {value.width > 0 && (
                    <span className="text-[#666] text-xs ml-auto">
                      {value.width}×{value.height}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[#666] hover:text-white"
            onClick={handleRefresh}
            disabled={!url || isLoading}
            title="Refresh preview"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", iframeLoading && "animate-spin")} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[#666] hover:text-white"
            onClick={handleOpenExternal}
            disabled={!url}
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[#666] hover:text-white"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Preview area */}
      <div 
        className={cn(
          "flex-1 flex items-center justify-center bg-[#0a0a0a] p-4 overflow-auto",
          isFullscreen ? "h-full" : "h-[500px]"
        )}
      >
        {error ? (
          // Error state
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <div>
              <p className="text-[#ccc] font-medium">Preview Error</p>
              <p className="text-[#666] text-sm mt-1">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="text-[#ccc] border-[#333] hover:bg-[#222]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : !url ? (
          // No URL state
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            {isLoading ? (
              <>
                <Loader2 className="w-12 h-12 text-[#666] animate-spin" />
                <div>
                  <p className="text-[#ccc] font-medium">Starting sandbox...</p>
                  <p className="text-[#666] text-sm mt-1">This may take a few seconds</p>
                </div>
              </>
            ) : (
              <>
                <Monitor className="w-12 h-12 text-[#333]" />
                <div>
                  <p className="text-[#666] font-medium">No preview available</p>
                  <p className="text-[#555] text-sm mt-1">
                    Preview will appear when the agent starts a dev server
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          // Iframe preview
          <div 
            className={cn(
              "relative bg-white rounded-lg overflow-hidden shadow-2xl transition-all duration-300",
              viewport !== 'full' && "border border-[#333]"
            )}
            style={getViewportStyle()}
          >
            {/* Loading overlay */}
            {iframeLoading && (
              <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center z-10">
                <Loader2 className="w-8 h-8 text-[#666] animate-spin" />
              </div>
            )}

            {/* Device frame for mobile/tablet */}
            {viewport !== 'full' && viewport !== 'desktop' && (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-20 h-1 bg-[#333] rounded-full" />
            )}

            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={url}
              className="w-full h-full border-0"
              onLoad={handleIframeLoad}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              title="Sandbox Preview"
            />
          </div>
        )}
      </div>

      {/* URL bar */}
      {url && (
        <div className="px-4 py-2 bg-[#111] border-t border-[#333]">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] rounded-md">
            <Globe className="w-3.5 h-3.5 text-[#666]" />
            <span className="text-xs text-[#888] truncate flex-1">{url}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SandboxPreview;
