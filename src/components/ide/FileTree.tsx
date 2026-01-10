import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode, FileJson, FileText, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FileTreeProps {
  files: FileNode[];
  selectedPath: string | null;
  onFileSelect: (path: string) => void;
  className?: string;
}

interface TreeItemProps {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onFileSelect: (path: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
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

function TreeItem({
  node,
  depth,
  selectedPath,
  onFileSelect,
  expandedFolders,
  toggleFolder,
}: TreeItemProps) {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = node.path === selectedPath;
  const isDirectory = node.type === 'directory';
  
  const Icon = isDirectory 
    ? (isExpanded ? FolderOpen : Folder)
    : getFileIcon(node.name);

  const handleClick = () => {
    if (isDirectory) {
      toggleFolder(node.path);
    } else {
      onFileSelect(node.path);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 cursor-pointer rounded-sm transition-colors',
          'hover:bg-accent/50',
          isSelected && 'bg-accent text-accent-foreground'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isDirectory && (
          <span className="w-4 h-4 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </span>
        )}
        {!isDirectory && <span className="w-4" />}
        <Icon className={cn(
          'h-4 w-4 shrink-0',
          isDirectory ? 'text-primary' : 'text-muted-foreground'
        )} />
        <span className="text-xs font-medium truncate">{node.name}</span>
      </div>
      
      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children
            .sort((a, b) => {
              // Directories first, then alphabetically
              if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onFileSelect={onFileSelect}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({
  files,
  selectedPath,
  onFileSelect,
  className,
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['/', '/src'])
  );

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Sort files: directories first, then alphabetically
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [files]);

  return (
    <div className={cn('h-full bg-muted/30', className)}>
      <div className="h-8 px-3 flex items-center border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Explorer
        </span>
      </div>
      <ScrollArea className="h-[calc(100%-2rem)]">
        <div className="py-1">
          {sortedFiles.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onFileSelect={onFileSelect}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// Helper to build file tree from flat paths
export function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];
  
  for (const path of paths) {
    const parts = path.split('/').filter(Boolean);
    let currentLevel = root;
    let currentPath = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
      const isFile = i === parts.length - 1;
      
      let existing = currentLevel.find((n) => n.name === part);
      
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          children: isFile ? undefined : [],
        };
        currentLevel.push(existing);
      }
      
      if (!isFile && existing.children) {
        currentLevel = existing.children;
      }
    }
  }
  
  return root;
}
