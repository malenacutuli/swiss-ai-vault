import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { 
  Maximize2, 
  Minimize2, 
  Search, 
  Trash2, 
  Download,
  Pause,
  Play,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface AgentTerminalProps {
  taskId: string;
  className?: string;
  initialLogs?: string[];
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

// Swiss-themed terminal colors (light theme with teal accents)
const SWISS_THEME = {
  background: '#FAFAF8',
  foreground: '#1a1a1a',
  cursor: '#1D4E5F',
  cursorAccent: '#FAFAF8',
  selectionBackground: '#1D4E5F40',
  selectionForeground: '#1a1a1a',
  // ANSI Colors
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

export function AgentTerminal({ 
  taskId, 
  className,
  initialLogs = [],
  onFullscreenChange 
}: AgentTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [outputBuffer, setOutputBuffer] = useState<string[]>([]);

  // Format log line with ANSI colors based on type
  const formatLogLine = useCallback((content: string, type?: string): string => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const prefix = `\x1b[38;2;113;113;122m[${timestamp}]\x1b[0m `;

    switch (type) {
      case 'error':
        return prefix + `\x1b[38;2;114;47;55m✕ ${content}\x1b[0m`;
      case 'success':
        return prefix + `\x1b[38;2;29;78;95m✓ ${content}\x1b[0m`;
      case 'command':
        return prefix + `\x1b[38;2;29;78;95m$ ${content}\x1b[0m`;
      case 'warning':
        return prefix + `\x1b[38;2;184;134;11m⚠ ${content}\x1b[0m`;
      case 'info':
        return prefix + `\x1b[38;2;113;113;122mℹ ${content}\x1b[0m`;
      default:
        return prefix + content;
    }
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || terminalInstance.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
      fontWeight: '400',
      letterSpacing: 0,
      lineHeight: 1.4,
      theme: SWISS_THEME,
      allowProposedApi: true,
      scrollback: 10000,
      convertEol: true,
      disableStdin: true, // Read-only terminal
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    
    // Initial fit
    setTimeout(() => fitAddon.fit(), 0);

    terminalInstance.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Write initial welcome message
    term.writeln('\x1b[38;2;29;78;95m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    term.writeln('\x1b[38;2;29;78;95m  Swiss Agents Terminal\x1b[0m');
    term.writeln('\x1b[38;2;113;113;122m  Task: ' + taskId.slice(0, 8) + '...\x1b[0m');
    term.writeln('\x1b[38;2;29;78;95m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
    term.writeln('');

    // Write initial logs if provided
    initialLogs.forEach(log => {
      term.writeln(formatLogLine(log));
    });

    // Handle scroll events to detect manual scrolling
    term.onScroll(() => {
      const buffer = term.buffer.active;
      const isAtBottom = buffer.viewportY >= buffer.baseY;
      if (!isAtBottom && autoScroll) {
        setAutoScroll(false);
      }
    });

    return () => {
      term.dispose();
      terminalInstance.current = null;
    };
  }, [taskId]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        setTimeout(() => fitAddonRef.current?.fit(), 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Refit on fullscreen change
  useEffect(() => {
    if (fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 100);
    }
    onFullscreenChange?.(isFullscreen);
  }, [isFullscreen, onFullscreenChange]);

  // Fetch existing logs on mount
  useEffect(() => {
    const fetchExistingLogs = async () => {
      try {
        const { data: logs, error } = await supabase
          .from('agent_task_logs')
          .select('content, log_type, timestamp, sequence_number')
          .eq('task_id', taskId)
          .order('sequence_number', { ascending: true })
          .order('timestamp', { ascending: true });

        if (error) {
          console.error('[Terminal] Failed to fetch logs:', error);
          if (terminalInstance.current) {
            terminalInstance.current.writeln(formatLogLine('Waiting for task execution...', 'info'));
          }
          return;
        }

        if (logs && logs.length > 0 && terminalInstance.current) {
          logs.forEach((log) => {
            const formatted = formatLogLine(log.content, log.log_type);
            terminalInstance.current!.writeln(formatted);
            setOutputBuffer(prev => [...prev, log.content]);
          });

          if (autoScroll) {
            terminalInstance.current.scrollToBottom();
          }
        } else if (terminalInstance.current) {
          // No logs yet - show waiting message
          terminalInstance.current.writeln(formatLogLine('Waiting for task execution...', 'info'));
        }
      } catch (err) {
        console.error('[Terminal] Error fetching logs:', err);
        if (terminalInstance.current) {
          terminalInstance.current.writeln(formatLogLine('Error loading logs. Check console.', 'error'));
        }
      }
    };

    if (terminalInstance.current) {
      fetchExistingLogs();
    }
  }, [taskId, formatLogLine, autoScroll]);

  // Subscribe to real-time logs
  useEffect(() => {
    const channel = supabase
      .channel(`terminal-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_task_logs',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          const log = payload.new as { content: string; log_type: string };
          if (terminalInstance.current) {
            const formatted = formatLogLine(log.content, log.log_type);
            terminalInstance.current.writeln(formatted);
            setOutputBuffer(prev => [...prev, log.content]);

            if (autoScroll) {
              terminalInstance.current.scrollToBottom();
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [taskId, autoScroll, formatLogLine]);

  // Write output to terminal (for external use)
  const writeOutput = useCallback((text: string, type?: string) => {
    if (terminalInstance.current) {
      const formatted = formatLogLine(text, type);
      terminalInstance.current.writeln(formatted);
      setOutputBuffer(prev => [...prev, text]);
      
      if (autoScroll) {
        terminalInstance.current.scrollToBottom();
      }
    }
  }, [formatLogLine, autoScroll]);

  // Clear terminal
  const handleClear = useCallback(() => {
    if (terminalInstance.current) {
      terminalInstance.current.clear();
      setOutputBuffer([]);
    }
  }, []);

  // Toggle fullscreen
  const handleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Search functionality
  const handleSearch = useCallback((direction: 'next' | 'prev') => {
    if (searchAddonRef.current && searchQuery) {
      if (direction === 'next') {
        searchAddonRef.current.findNext(searchQuery);
      } else {
        searchAddonRef.current.findPrevious(searchQuery);
      }
    }
  }, [searchQuery]);

  // Download terminal output
  const handleDownload = useCallback(() => {
    const content = outputBuffer.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-output-${taskId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [outputBuffer, taskId]);

  // Resume auto-scroll
  const handleResumeAutoScroll = useCallback(() => {
    setAutoScroll(true);
    terminalInstance.current?.scrollToBottom();
  }, []);

  return (
    <div 
      className={cn(
        'flex flex-col bg-[#FAFAF8] border border-border rounded-lg overflow-hidden',
        isFullscreen && 'fixed inset-4 z-50 shadow-2xl',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <span className="text-xs font-medium text-muted-foreground ml-2">
            Terminal — {taskId.slice(0, 8)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Search toggle */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search className="h-3.5 w-3.5" />
          </Button>

          {/* Clear button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          {/* Download button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleDownload}
            disabled={outputBuffer.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>

          {/* Fullscreen toggle */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Search bar */}
      {isSearchOpen && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(e.shiftKey ? 'prev' : 'next');
              } else if (e.key === 'Escape') {
                setIsSearchOpen(false);
              }
            }}
            placeholder="Search terminal output..."
            className="h-7 text-sm flex-1"
            autoFocus
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => handleSearch('prev')}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => handleSearch('next')}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setIsSearchOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Terminal container */}
      <div 
        ref={terminalRef} 
        className="flex-1 min-h-[300px] p-2"
        style={{ backgroundColor: SWISS_THEME.background }}
      />

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <div className="absolute bottom-4 right-4">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleResumeAutoScroll}
            className="shadow-lg"
          >
            <Play className="h-3 w-3 mr-1" />
            Resume auto-scroll
          </Button>
        </div>
      )}
    </div>
  );
}

// Export writeOutput method for external use
export type AgentTerminalRef = {
  writeOutput: (text: string, type?: string) => void;
  clear: () => void;
};
