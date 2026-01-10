import React from 'react';
import { X, FileCode, FileJson, FileText, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export interface EditorTab {
  id: string;
  path: string;
  filename: string;
  language: string;
  isDirty: boolean;
}

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  className?: string;
}

// Get icon based on file extension
function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const iconMap: Record<string, React.ElementType> = {
    ts: FileCode,
    tsx: FileCode,
    js: FileCode,
    jsx: FileCode,
    json: FileJson,
    md: FileText,
    txt: FileText,
  };
  
  return iconMap[ext || ''] || File;
}

export function EditorTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  className,
}: EditorTabsProps) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={cn('border-b border-border bg-muted/30', className)}>
      <ScrollArea className="w-full">
        <div className="flex h-9">
          {tabs.map((tab) => {
            const Icon = getFileIcon(tab.filename);
            const isActive = tab.id === activeTabId;
            
            return (
              <div
                key={tab.id}
                className={cn(
                  'group flex items-center gap-2 px-3 h-full border-r border-border cursor-pointer transition-colors',
                  'hover:bg-accent/50',
                  isActive 
                    ? 'bg-background border-b-2 border-b-primary' 
                    : 'bg-muted/50'
                )}
                onClick={() => onTabSelect(tab.id)}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className={cn(
                  'text-xs font-medium truncate max-w-32',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {tab.filename}
                </span>
                {tab.isDirty && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
                <button
                  className={cn(
                    'h-4 w-4 rounded-sm flex items-center justify-center transition-opacity shrink-0',
                    'hover:bg-destructive/20 hover:text-destructive',
                    'opacity-0 group-hover:opacity-100',
                    isActive && 'opacity-60'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
