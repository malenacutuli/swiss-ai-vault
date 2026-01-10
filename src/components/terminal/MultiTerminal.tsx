import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Terminal, TerminalRef } from './Terminal';
import { TerminalTabs, TerminalTab } from './TerminalTabs';
import { TerminalToolbar } from './TerminalToolbar';
import { cn } from '@/lib/utils';

interface MultiTerminalProps {
  websocketBaseUrl?: string;
  className?: string;
  theme?: 'light' | 'dark';
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

interface TerminalInstance {
  id: string;
  name: string;
  ref: React.RefObject<TerminalRef>;
  isConnected: boolean;
  hasUnread: boolean;
}

let terminalCounter = 1;

export function MultiTerminal({
  websocketBaseUrl,
  className,
  theme = 'light',
  onFullscreenChange,
}: MultiTerminalProps) {
  const [terminals, setTerminals] = useState<TerminalInstance[]>(() => [{
    id: 'terminal-1',
    name: 'Terminal 1',
    ref: React.createRef<TerminalRef>(),
    isConnected: false,
    hasUnread: false,
  }]);
  const [activeTerminalId, setActiveTerminalId] = useState('terminal-1');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTerminal = terminals.find((t) => t.id === activeTerminalId);

  // Create new terminal
  const handleNewTerminal = useCallback(() => {
    terminalCounter++;
    const newTerminal: TerminalInstance = {
      id: `terminal-${terminalCounter}`,
      name: `Terminal ${terminalCounter}`,
      ref: React.createRef<TerminalRef>(),
      isConnected: false,
      hasUnread: false,
    };
    setTerminals((prev) => [...prev, newTerminal]);
    setActiveTerminalId(newTerminal.id);
  }, []);

  // Close terminal
  const handleCloseTerminal = useCallback((id: string) => {
    setTerminals((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      if (filtered.length === 0) {
        // Create a new terminal if closing the last one
        terminalCounter++;
        return [{
          id: `terminal-${terminalCounter}`,
          name: `Terminal ${terminalCounter}`,
          ref: React.createRef<TerminalRef>(),
          isConnected: false,
          hasUnread: false,
        }];
      }
      return filtered;
    });
    
    // Switch to another terminal if closing the active one
    if (id === activeTerminalId) {
      setTerminals((prev) => {
        const remaining = prev.filter((t) => t.id !== id);
        if (remaining.length > 0) {
          setActiveTerminalId(remaining[remaining.length - 1].id);
        }
        return prev;
      });
    }
  }, [activeTerminalId]);

  // Update connection status
  const handleConnect = useCallback((id: string) => {
    setTerminals((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isConnected: true } : t))
    );
  }, []);

  const handleDisconnect = useCallback((id: string) => {
    setTerminals((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isConnected: false } : t))
    );
  }, []);

  // Clear terminal
  const handleClear = useCallback(() => {
    activeTerminal?.ref.current?.clear();
  }, [activeTerminal]);

  // Kill process (send SIGINT)
  const handleKill = useCallback(() => {
    activeTerminal?.ref.current?.write('\x03'); // Ctrl+C
  }, [activeTerminal]);

  // Search
  const handleSearch = useCallback((query: string, direction: 'next' | 'prev') => {
    activeTerminal?.ref.current?.search(query, direction);
  }, [activeTerminal]);

  // Download output
  const handleDownload = useCallback(() => {
    const content = activeTerminal?.ref.current?.serialize() || '';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTerminal?.name || 'terminal'}-output.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeTerminal]);

  // Fullscreen toggle
  const handleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  useEffect(() => {
    onFullscreenChange?.(isFullscreen);
  }, [isFullscreen, onFullscreenChange]);

  // Refit terminals on fullscreen change
  useEffect(() => {
    setTimeout(() => {
      terminals.forEach((t) => t.ref.current?.fit());
    }, 100);
  }, [isFullscreen, terminals]);

  // Get tabs data
  const tabs: TerminalTab[] = terminals.map((t) => ({
    id: t.id,
    name: t.name,
    isConnected: t.isConnected,
    hasUnread: t.hasUnread,
  }));

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col rounded-lg border border-border overflow-hidden',
        isFullscreen && 'fixed inset-4 z-50 shadow-2xl',
        theme === 'light' ? 'bg-[#FAFAF8]' : 'bg-[#0a0a0f]',
        className
      )}
    >
      {/* Toolbar */}
      <TerminalToolbar
        tabs={tabs}
        activeTabId={activeTerminalId}
        onTabSelect={setActiveTerminalId}
        onClear={handleClear}
        onKill={handleKill}
        onSearch={handleSearch}
        onDownload={handleDownload}
        onFullscreen={handleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* Tabs */}
      <TerminalTabs
        tabs={tabs}
        activeTabId={activeTerminalId}
        onTabSelect={setActiveTerminalId}
        onTabClose={handleCloseTerminal}
        onNewTab={handleNewTerminal}
      />

      {/* Terminal panels */}
      <div className="flex-1 relative min-h-[300px]">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            className={cn(
              'absolute inset-0',
              activeTerminalId === terminal.id ? 'visible' : 'invisible'
            )}
          >
            <Terminal
              ref={terminal.ref}
              sessionId={terminal.id}
              websocketUrl={websocketBaseUrl ? `${websocketBaseUrl}?session=${terminal.id}` : undefined}
              theme={theme}
              onConnect={() => handleConnect(terminal.id)}
              onDisconnect={() => handleDisconnect(terminal.id)}
              className="h-full"
            />
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 text-xs text-muted-foreground bg-muted/30 border-t border-border">
        <span>
          {activeTerminal?.isConnected ? (
            <span className="text-green-600">● Connected</span>
          ) : (
            <span className="text-muted-foreground">○ Disconnected</span>
          )}
        </span>
        <span>{terminals.length} terminal{terminals.length > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
