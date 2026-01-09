import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Download,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  FileArchive,
  Music,
  Video,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  language?: string;
}

interface FileBrowserProps {
  files: FileNode[];
  selectedPath?: string;
  onSelect: (file: FileNode) => void;
  onDownload?: (file: FileNode) => void;
  onDownloadAll?: () => void;
  className?: string;
}

// Get icon based on file extension
function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const iconMap: Record<string, React.ElementType> = {
    // Code files
    ts: FileCode,
    tsx: FileCode,
    js: FileCode,
    jsx: FileCode,
    py: FileCode,
    rs: FileCode,
    go: FileCode,
    rb: FileCode,
    php: FileCode,
    java: FileCode,
    c: FileCode,
    cpp: FileCode,
    cs: FileCode,
    swift: FileCode,
    kt: FileCode,
    // Data files
    json: FileJson,
    yaml: FileJson,
    yml: FileJson,
    xml: FileJson,
    toml: FileJson,
    // Text/docs
    md: FileText,
    txt: FileText,
    doc: FileText,
    docx: FileText,
    pdf: FileText,
    // Spreadsheets
    csv: FileSpreadsheet,
    xlsx: FileSpreadsheet,
    xls: FileSpreadsheet,
    // Images
    png: FileImage,
    jpg: FileImage,
    jpeg: FileImage,
    gif: FileImage,
    svg: FileImage,
    webp: FileImage,
    // Audio
    mp3: Music,
    wav: Music,
    ogg: Music,
    m4a: Music,
    // Video
    mp4: Video,
    webm: Video,
    mov: Video,
    // Archives
    zip: FileArchive,
    tar: FileArchive,
    gz: FileArchive,
    rar: FileArchive,
  };

  return iconMap[ext || ''] || File;
}

// Format file size
function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// File tree node component
function FileTreeNode({
  node,
  depth = 0,
  selectedPath,
  expandedPaths,
  onToggle,
  onSelect,
  onDownload,
}: {
  node: FileNode;
  depth?: number;
  selectedPath?: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (file: FileNode) => void;
  onDownload?: (file: FileNode) => void;
}) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const isDirectory = node.type === 'directory';
  const FileIcon = isDirectory 
    ? (isExpanded ? FolderOpen : Folder) 
    : getFileIcon(node.name);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 cursor-pointer rounded-md text-sm',
          'hover:bg-muted/60 transition-colors group',
          isSelected && 'bg-primary/10 text-primary'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (isDirectory) {
            onToggle(node.path);
          } else {
            onSelect(node);
          }
        }}
      >
        {isDirectory ? (
          <button
            className="p-0.5 hover:bg-muted rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.path);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        
        <FileIcon className={cn(
          'h-4 w-4 flex-shrink-0',
          isDirectory ? 'text-primary' : 'text-muted-foreground'
        )} />
        
        <span className="flex-1 truncate">{node.name}</span>
        
        {node.size && (
          <span className="text-xs text-muted-foreground">
            {formatSize(node.size)}
          </span>
        )}
        
        {!isDirectory && onDownload && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(node);
            }}
          >
            <Download className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onSelect={onSelect}
              onDownload={onDownload}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileBrowser({
  files,
  selectedPath,
  onSelect,
  onDownload,
  onDownloadAll,
  className,
}: FileBrowserProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Count total files
  const fileCount = useMemo(() => {
    let count = 0;
    const countFiles = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file') count++;
        if (node.children) countFiles(node.children);
      }
    };
    countFiles(files);
    return count;
  }, [files]);

  const handleToggle = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Expand all directories initially
  React.useEffect(() => {
    const allPaths = new Set<string>();
    const collectPaths = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'directory') {
          allPaths.add(node.path);
          if (node.children) collectPaths(node.children);
        }
      }
    };
    collectPaths(files);
    setExpandedPaths(allPaths);
  }, [files]);

  if (files.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8 text-muted-foreground', className)}>
        <File className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No files generated yet</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium">
          Files ({fileCount})
        </span>
        {onDownloadAll && fileCount > 0 && (
          <Button size="sm" variant="outline" onClick={onDownloadAll}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Download All
          </Button>
        )}
      </div>

      {/* File tree */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {files.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onToggle={handleToggle}
              onSelect={onSelect}
              onDownload={onDownload}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// Utility to build file tree from flat file list
export function buildFileTree(files: { path: string; size?: number }[]): FileNode[] {
  const root: FileNode[] = [];
  const pathMap = new Map<string, FileNode>();

  // Sort files by path for consistent ordering
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sortedFiles) {
    const parts = file.path.split('/');
    let currentPath = '';
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      let node = pathMap.get(currentPath);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          size: isFile ? file.size : undefined,
          children: isFile ? undefined : [],
        };
        pathMap.set(currentPath, node);
        currentLevel.push(node);
      }

      if (!isFile && node.children) {
        currentLevel = node.children;
      }
    }
  }

  return root;
}
