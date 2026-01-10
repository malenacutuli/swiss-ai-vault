import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SerializeAddon } from '@xterm/addon-serialize';
import { WebglAddon } from '@xterm/addon-webgl';
import 'xterm/css/xterm.css';
import { cn } from '@/lib/utils';

// Light theme matching Monaco editor (Swiss design)
export const TERMINAL_LIGHT_THEME = {
  background: '#FAFAF8',
  foreground: '#1a1a1a',
  cursor: '#1D4E5F',
  cursorAccent: '#FAFAF8',
  selectionBackground: '#1D4E5F40',
  selectionForeground: '#1a1a1a',
  black: '#1a1a1a',
  red: '#722F37',
  green: '#1D4E5F',
  yellow: '#B8860B',
  blue: '#2563eb',
  magenta: '#7c3aed',
  cyan: '#0891b2',
  white: '#e4e4e7',
  brightBlack: '#71717a',
  brightRed: '#ef4444',
  brightGreen: '#22c55e',
  brightYellow: '#eab308',
  brightBlue: '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan: '#06b6d4',
  brightWhite: '#fafafa',
};

// Dark theme
export const TERMINAL_DARK_THEME = {
  background: '#0a0a0f',
  foreground: '#e4e4e7',
  cursor: '#4EC9B0',
  cursorAccent: '#0a0a0f',
  selectionBackground: '#4EC9B040',
  selectionForeground: '#e4e4e7',
  black: '#0a0a0f',
  red: '#f87171',
  green: '#4EC9B0',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e4e4e7',
  brightBlack: '#71717a',
  brightRed: '#fca5a5',
  brightGreen: '#6ee7b7',
  brightYellow: '#fcd34d',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#fafafa',
};

export interface TerminalSession {
  id: string;
  name: string;
  isConnected: boolean;
  hasUnread: boolean;
}

export interface TerminalProps {
  sessionId: string;
  websocketUrl?: string;
  className?: string;
  theme?: 'light' | 'dark';
  fontSize?: number;
  fontFamily?: string;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  readOnly?: boolean;
}

export interface TerminalRef {
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
  focus: () => void;
  fit: () => void;
  search: (query: string, direction?: 'next' | 'prev') => boolean;
  serialize: () => string;
  restore: (data: string) => void;
  getTerminal: () => XTerm | null;
}

// Storage key for persisting terminal state
const getStorageKey = (sessionId: string) => `terminal-session-${sessionId}`;

export const Terminal = forwardRef<TerminalRef, TerminalProps>(({
  sessionId,
  websocketUrl,
  className,
  theme = 'light',
  fontSize = 13,
  fontFamily = '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
  onData,
  onResize,
  onConnect,
  onDisconnect,
  readOnly = false,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const serializeAddonRef = useRef<SerializeAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize,
      fontFamily,
      fontWeight: '400',
      letterSpacing: 0,
      lineHeight: 1.4,
      theme: theme === 'light' ? TERMINAL_LIGHT_THEME : TERMINAL_DARK_THEME,
      allowProposedApi: true,
      scrollback: 10000,
      convertEol: true,
      disableStdin: readOnly,
    });

    // Load addons
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    const serializeAddon = new SerializeAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(serializeAddon);

    // Open terminal
    term.open(containerRef.current);

    // Try WebGL renderer (falls back to canvas if not available)
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      term.loadAddon(webglAddon);
      webglAddonRef.current = webglAddon;
    } catch (e) {
      console.warn('WebGL not available, using canvas renderer');
    }

    // Initial fit
    setTimeout(() => fitAddon.fit(), 0);

    // Store refs
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;
    serializeAddonRef.current = serializeAddon;

    // Restore saved state
    const savedState = localStorage.getItem(getStorageKey(sessionId));
    if (savedState) {
      try {
        term.write(savedState);
      } catch (e) {
        console.warn('Failed to restore terminal state:', e);
      }
    }

    // Handle user input
    if (!readOnly) {
      term.onData((data) => {
        onData?.(data);
        // Send to WebSocket if connected
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'input', data }));
        }
      });
    }

    // Handle resize
    term.onResize(({ cols, rows }) => {
      onResize?.(cols, rows);
      // Send resize to WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    // Cleanup
    return () => {
      // Save state before disposing
      if (serializeAddonRef.current && terminalRef.current) {
        try {
          const state = serializeAddonRef.current.serialize();
          localStorage.setItem(getStorageKey(sessionId), state);
        } catch (e) {
          console.warn('Failed to save terminal state:', e);
        }
      }
      
      webglAddonRef.current?.dispose();
      term.dispose();
      terminalRef.current = null;
    };
  }, [sessionId, fontSize, fontFamily, theme, readOnly, onData, onResize]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        setTimeout(() => fitAddonRef.current?.fit(), 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update theme
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = theme === 'light' ? TERMINAL_LIGHT_THEME : TERMINAL_DARK_THEME;
    }
  }, [theme]);

  // WebSocket connection
  useEffect(() => {
    if (!websocketUrl) return;

    const connect = () => {
      const ws = new WebSocket(websocketUrl);

      ws.onopen = () => {
        setIsConnected(true);
        onConnect?.();
        terminalRef.current?.writeln('\x1b[32m● Connected\x1b[0m');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'output' && terminalRef.current) {
            terminalRef.current.write(message.data);
          }
        } catch {
          // If not JSON, write raw data
          terminalRef.current?.write(event.data);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        onDisconnect?.();
        terminalRef.current?.writeln('\x1b[31m● Disconnected\x1b[0m');
        
        // Auto-reconnect after 3 seconds
        setTimeout(() => {
          if (wsRef.current === ws) {
            connect();
          }
        }, 3000);
      };

      ws.onerror = () => {
        terminalRef.current?.writeln('\x1b[31m● Connection error\x1b[0m');
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [websocketUrl, onConnect, onDisconnect]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+F for search (handled by search addon)
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        // Let the terminal handle this
      }
      
      // Copy (Cmd/Ctrl+C when selection exists)
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && terminalRef.current?.hasSelection()) {
        const selection = terminalRef.current.getSelection();
        navigator.clipboard.writeText(selection);
        e.preventDefault();
      }
      
      // Paste (Cmd/Ctrl+V)
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !readOnly) {
        navigator.clipboard.readText().then((text) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
          }
          onData?.(text);
        });
        e.preventDefault();
      }
    };

    const container = containerRef.current;
    container?.addEventListener('keydown', handleKeyDown);
    return () => container?.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, onData]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    write: (data: string) => terminalRef.current?.write(data),
    writeln: (data: string) => terminalRef.current?.writeln(data),
    clear: () => terminalRef.current?.clear(),
    focus: () => terminalRef.current?.focus(),
    fit: () => fitAddonRef.current?.fit(),
    search: (query: string, direction: 'next' | 'prev' = 'next') => {
      if (!searchAddonRef.current) return false;
      return direction === 'next' 
        ? searchAddonRef.current.findNext(query) 
        : searchAddonRef.current.findPrevious(query);
    },
    serialize: () => serializeAddonRef.current?.serialize() || '',
    restore: (data: string) => terminalRef.current?.write(data),
    getTerminal: () => terminalRef.current,
  }), []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'w-full h-full min-h-[200px]',
        theme === 'light' ? 'bg-[#FAFAF8]' : 'bg-[#0a0a0f]',
        className
      )}
      style={{ padding: 8 }}
    />
  );
});

Terminal.displayName = 'Terminal';
