import React from 'react';
import { X, Plus, Terminal as TerminalIcon, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export interface TerminalTab {
  id: string;
  name: string;
  isConnected: boolean;
  hasUnread: boolean;
}

interface TerminalTabsProps {
  tabs: TerminalTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab: () => void;
  className?: string;
}

export function TerminalTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  className,
}: TerminalTabsProps) {
  return (
    <div className={cn('flex items-center border-b border-border bg-muted/30', className)}>
      <ScrollArea className="flex-1">
        <div className="flex items-center">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'group flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer transition-colors min-w-[120px] max-w-[200px]',
                activeTabId === tab.id
                  ? 'bg-background text-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
              onClick={() => onTabSelect(tab.id)}
            >
              {/* Connection indicator */}
              <Circle
                className={cn(
                  'h-2 w-2 shrink-0',
                  tab.isConnected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'
                )}
              />
              
              {/* Terminal icon */}
              <TerminalIcon className="h-3.5 w-3.5 shrink-0" />
              
              {/* Tab name */}
              <span className="text-xs font-medium truncate flex-1">
                {tab.name}
              </span>
              
              {/* Unread indicator */}
              {tab.hasUnread && activeTabId !== tab.id && (
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
              
              {/* Close button */}
              {tabs.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      
      {/* New tab button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-none border-l border-border"
        onClick={onNewTab}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
