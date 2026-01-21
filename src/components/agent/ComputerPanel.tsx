/**
 * ComputerPanel - Manus.im Parity Computer Interface
 * 
 * This component replicates the right-side computer panel from Manus.im
 * including Terminal and Preview tabs with real-time output.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  Monitor,
  Smartphone,
  Tablet,
  Maximize2,
  Minimize2,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Pause,
  Play,
  Square,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Home,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Types
interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'info' | 'success';
  content: string;
  timestamp: string;
}

interface ComputerPanelProps {
  taskId?: string;
  terminalLines?: TerminalLine[];
  previewUrl?: string;
  isExecuting?: boolean;
  onRefresh?: () => void;
  onOpenExternal?: () => void;
  onDeviceChange?: (device: 'desktop' | 'tablet' | 'mobile') => void;
}

// Terminal Component
const TerminalView: React.FC<{
  lines: TerminalLine[];
  isExecuting?: boolean;
}> = ({ lines, isExecuting }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const handleCopy = () => {
    const text = lines.map(l => l.content).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return 'text-green-400';
      case 'output': return 'text-gray-300';
      case 'error': return 'text-red-400';
      case 'info': return 'text-blue-400';
      case 'success': return 'text-green-500';
      default: return 'text-gray-300';
    }
  };

  const getLinePrefix = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return '$ ';
      case 'error': return '✗ ';
      case 'info': return 'ℹ ';
      case 'success': return '✓ ';
      default: return '';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] rounded-lg overflow-hidden">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27ca40]" />
          </div>
          <span className="text-xs text-gray-400 ml-2">SwissVault Terminal</span>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-[#3d3d3d]"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy output</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Terminal Content */}
      <div
        ref={terminalRef}
        className="flex-1 p-3 overflow-auto font-mono text-sm"
      >
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <TerminalIcon className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Waiting for task execution...</p>
            <p className="text-xs mt-1 opacity-60">Terminal output will appear here</p>
          </div>
        ) : (
          <div className="space-y-1">
            {lines.map((line) => (
              <div key={line.id} className={cn("whitespace-pre-wrap break-all", getLineColor(line.type))}>
                <span className="opacity-60">{getLinePrefix(line.type)}</span>
                {line.content}
              </div>
            ))}
            {isExecuting && (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="animate-pulse">_</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Terminal Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] border-t border-[#3d3d3d]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isExecuting ? "bg-green-500 animate-pulse" : "bg-gray-500"
            )} />
            <span className="text-xs text-gray-400">
              {isExecuting ? 'Running' : 'Idle'}
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {lines.length} lines
        </div>
      </div>
    </div>
  );
};

// Preview Component
const PreviewView: React.FC<{
  url?: string;
  device: 'desktop' | 'tablet' | 'mobile';
  onDeviceChange: (device: 'desktop' | 'tablet' | 'mobile') => void;
  onRefresh: () => void;
  onOpenExternal: () => void;
}> = ({ url, device, onDeviceChange, onRefresh, onOpenExternal }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const deviceSizes = {
    desktop: { width: '100%', height: '100%' },
    tablet: { width: '768px', height: '1024px' },
    mobile: { width: '375px', height: '667px' },
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setError(null);
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    onRefresh();
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError('Failed to load preview');
  };

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5] dark:bg-[#1e1e1e] rounded-lg overflow-hidden">
      {/* Preview Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-[#2d2d2d] border-b">
        {/* Device Toggles */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={device === 'desktop' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onDeviceChange('desktop')}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Desktop</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={device === 'tablet' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onDeviceChange('tablet')}
                >
                  <Tablet className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tablet</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={device === 'mobile' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onDeviceChange('mobile')}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mobile</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* URL Bar */}
        <div className="flex-1 mx-4 flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleRefresh}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <Home className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 bg-muted rounded-md px-3 py-1.5 text-sm truncate">
            {url || 'No preview available'}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={onOpenExternal}
                  disabled={!url}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in new tab</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fullscreen</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {!url ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <Monitor className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">No Preview Available</p>
            <p className="text-sm mt-1 opacity-60">
              Start a task to see the live preview
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center text-destructive">
            <AlertCircle className="h-12 w-12 mb-3" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              "bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300",
              device !== 'desktop' && "border-8 border-gray-800 rounded-3xl"
            )}
            style={deviceSizes[device]}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={url}
              className="w-full h-full border-0"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Main Computer Panel Component
export const ComputerPanel: React.FC<ComputerPanelProps> = ({
  taskId,
  terminalLines = [],
  previewUrl,
  isExecuting = false,
  onRefresh,
  onOpenExternal,
  onDeviceChange,
}) => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'preview'>('terminal');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleDeviceChange = (newDevice: 'desktop' | 'tablet' | 'mobile') => {
    setDevice(newDevice);
    onDeviceChange?.(newDevice);
  };

  const handleRefresh = () => {
    onRefresh?.();
  };

  const handleOpenExternal = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
    onOpenExternal?.();
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-background border-l",
      isFullscreen && "fixed inset-0 z-50"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            <span className="text-sm font-medium">SwissVault Computer</span>
          </div>
        </div>

        {/* Tab Toggles */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <Button
            variant={activeTab === 'terminal' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs gap-1.5"
            onClick={() => setActiveTab('terminal')}
          >
            <TerminalIcon className="h-3.5 w-3.5" />
            Terminal
          </Button>
          <Button
            variant={activeTab === 'preview' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs gap-1.5"
            onClick={() => setActiveTab('preview')}
          >
            <Monitor className="h-3.5 w-3.5" />
            Preview
          </Button>
        </div>

        {/* Fullscreen Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Content */}
      <div className="flex-1 p-2 overflow-hidden">
        {activeTab === 'terminal' ? (
          <TerminalView lines={terminalLines} isExecuting={isExecuting} />
        ) : (
          <PreviewView
            url={previewUrl}
            device={device}
            onDeviceChange={handleDeviceChange}
            onRefresh={handleRefresh}
            onOpenExternal={handleOpenExternal}
          />
        )}
      </div>

      {/* Footer with controls */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
        <div className="flex items-center gap-2">
          {isExecuting && (
            <Badge variant="secondary" className="gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Running
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Sandbox: Active</span>
        </div>
      </div>
    </div>
  );
};

export default ComputerPanel;
