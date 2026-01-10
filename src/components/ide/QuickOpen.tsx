import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FileCode, FileJson, FileText, File, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

interface QuickOpenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: string[];
  onFileSelect: (path: string) => void;
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

export function QuickOpen({
  open,
  onOpenChange,
  files,
  onFileSelect,
}: QuickOpenProps) {
  const [search, setSearch] = useState('');

  // Reset search when opening
  useEffect(() => {
    if (open) {
      setSearch('');
    }
  }, [open]);

  // Filter files based on search
  const filteredFiles = useMemo(() => {
    if (!search) return files.slice(0, 50);
    
    const lowerSearch = search.toLowerCase();
    return files
      .filter((file) => {
        const filename = file.split('/').pop() || '';
        return (
          filename.toLowerCase().includes(lowerSearch) ||
          file.toLowerCase().includes(lowerSearch)
        );
      })
      .slice(0, 50);
  }, [files, search]);

  const handleSelect = useCallback((path: string) => {
    onFileSelect(path);
    onOpenChange(false);
  }, [onFileSelect, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search files..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No files found.</CommandEmpty>
        <CommandGroup heading="Files">
          {filteredFiles.map((file) => {
            const filename = file.split('/').pop() || file;
            const directory = file.split('/').slice(0, -1).join('/') || '/';
            const Icon = getFileIcon(filename);
            
            return (
              <CommandItem
                key={file}
                value={file}
                onSelect={() => handleSelect(file)}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{filename}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {directory}
                  </span>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

// Hook to manage quick open state with keyboard shortcut
export function useQuickOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
}
