/**
 * Agent Terminal Component
 * 
 * Real-time terminal display for agent execution using xterm.js
 * Shows command execution, output, and system messages
 */

import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { cn } from '@/lib/utils';
import { 
  Terminal, 
  Maximize2, 
  Minimize2, 
  Copy, 
  Trash2,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export interface TerminalLine {
  id: string;
  content: string;
  type: 'stdout' | 'stderr' | 'command' | 'system';
  timestamp: string;
}

interface AgentTerminalProps {
  lines: TerminalLine[];
  isConnected?: boolean;
  sandboxUrl?: string;
  className?: string;
  onClear?: () => void;
}

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  // Bright foreground
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

function formatLine(line: TerminalLine): string {
  const timestamp = new Date(line.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  
  switch (line.type) {
    case 'command':
      return `${COLORS.brightBlack}[${timestamp}]${COLORS.reset} ${COLORS.brightGreen}$${COLORS.reset} ${COLORS.bold}${line.content}${COLORS.reset}`;
    case 'stderr':
      return `${COLORS.brightBlack}[${timestamp}]${COLORS.reset} ${COLORS.red}${line.content}${COLORS.reset}`;
    case 'system':
      return `${COLORS.brightBlack}[${timestamp}]${COLORS.reset} ${COLORS.cyan}[system]${COLORS.reset} ${COLORS.dim}${line.content}${COLORS.reset}`;
    case 'stdout':
    default:
      return `${COLORS.brightBlack}[${timestamp}]${COLORS.reset} ${line.content}`;
  }
}

export function AgentTerminal({
  lines,
  isConnected = false,
  sandboxUrl,
  className,
  onClear,
}: AgentTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastLineCountRef = useRef(0);

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new XTerm({
      theme: {
        background: '#1a1a1a',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1a1a1a',
        selectionBackground: '#264f78',
        black: '#1a1a1a',
        red: '#f44747',
        green: '#6a9955',
        yellow: '#dcdcaa',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#d4d4d4',
        brightBlack: '#808080',
        brightRed: '#f44747',
        brightGreen: '#6a9955',
        brightYellow: '#dcdcaa',
        brightBlue: '#569cd6',
        brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0',
        brightWhite: '#ffffff',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      convertEol: true,
      disableStdin: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Welcome message
    xterm.writeln(`${COLORS.cyan}╔════════════════════════════════════════════════════════════╗${COLORS.reset}`);
    xterm.writeln(`${COLORS.cyan}║${COLORS.reset}  ${COLORS.bold}${COLORS.white}SwissBrain Agent Terminal${COLORS.reset}                                 ${COLORS.cyan}║${COLORS.reset}`);
    xterm.writeln(`${COLORS.cyan}║${COLORS.reset}  ${COLORS.dim}Real-time execution output${COLORS.reset}                               ${COLORS.cyan}║${COLORS.reset}`);
    xterm.writeln(`${COLORS.cyan}╚════════════════════════════════════════════════════════════╝${COLORS.reset}`);
    xterm.writeln('');

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
    };
  }, []);

  // Write new lines to terminal
  useEffect(() => {
    if (!xtermRef.current) return;

    // Only write new lines
    const newLines = lines.slice(lastLineCountRef.current);
    newLines.forEach(line => {
      xtermRef.current?.writeln(formatLine(line));
    });
    lastLineCountRef.current = lines.length;
  }, [lines]);

  // Refit on fullscreen toggle
  useEffect(() => {
    setTimeout(() => {
      fitAddonRef.current?.fit();
    }, 100);
  }, [isFullscreen]);

  // Copy terminal content
  const handleCopy = () => {
    const content = lines.map(l => `[${l.type}] ${l.content}`).join('\n');
    navigator.clipboard.writeText(content);
    toast.success('Terminal content copied');
  };

  // Clear terminal
  const handleClear = () => {
    xtermRef.current?.clear();
    lastLineCountRef.current = 0;
    onClear?.();
  };

  // Download logs
  const handleDownload = () => {
    const content = lines.map(l => 
      `[${new Date(l.timestamp).toISOString()}] [${l.type}] ${l.content}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-terminal-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs downloaded');
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
          <Terminal className="w-4 h-4 text-[#666]" />
          <span className="text-sm text-[#ccc] font-medium">Terminal</span>
          {isConnected && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {sandboxUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-[#888] hover:text-white"
              onClick={() => window.open(sandboxUrl, '_blank')}
            >
              Open Sandbox
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[#666] hover:text-white"
            onClick={handleCopy}
            title="Copy logs"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[#666] hover:text-white"
            onClick={handleDownload}
            title="Download logs"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[#666] hover:text-white"
            onClick={handleClear}
            title="Clear terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Terminal */}
      <div 
        ref={terminalRef} 
        className={cn(
          "flex-1 p-2",
          isFullscreen ? "h-full" : "h-[400px]"
        )}
      />
    </div>
  );
}

export default AgentTerminal;
