import React, { useState } from 'react';
import {
  Trash2,
  XCircle,
  Search,
  Download,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  X,
  Terminal as TerminalIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TerminalTab } from './TerminalTabs';

interface TerminalToolbarProps {
  tabs: TerminalTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onClear: () => void;
  onKill: () => void;
  onSearch: (query: string, direction: 'next' | 'prev') => void;
  onDownload: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
  className?: string;
}

export function TerminalToolbar({
  tabs,
  activeTabId,
  onTabSelect,
  onClear,
  onKill,
  onSearch,
  onDownload,
  onFullscreen,
  isFullscreen,
  className,
}: TerminalToolbarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch(searchQuery, e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <div className={cn('flex flex-col border-b border-border', className)}>
      {/* Main toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
        <div className="flex items-center gap-2">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          
          {/* Terminal selector dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-2 ml-2">
                <TerminalIcon className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">
                  {activeTab?.name || 'Terminal'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {tabs.map((tab) => (
                <DropdownMenuItem
                  key={tab.id}
                  onClick={() => onTabSelect(tab.id)}
                  className={cn(activeTabId === tab.id && 'bg-accent')}
                >
                  <TerminalIcon className="h-3.5 w-3.5 mr-2" />
                  {tab.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
            onClick={onClear}
            title="Clear terminal"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          {/* Kill process button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onKill}
            title="Kill process"
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>

          {/* Download button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onDownload}
            title="Download output"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>

          {/* Fullscreen toggle */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onFullscreen}
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
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search terminal output..."
            className="h-7 text-sm flex-1"
            autoFocus
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onSearch(searchQuery, 'prev')}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onSearch(searchQuery, 'next')}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
