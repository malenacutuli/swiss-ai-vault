/**
 * File Browser Component
 * 
 * Displays the sandbox file system with syntax-highlighted code preview
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Download,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

// File type icons
const FILE_ICONS: Record<string, React.ReactNode> = {
  // Code files
  ts: <FileCode className="w-4 h-4 text-blue-400" />,
  tsx: <FileCode className="w-4 h-4 text-blue-400" />,
  js: <FileCode className="w-4 h-4 text-yellow-400" />,
  jsx: <FileCode className="w-4 h-4 text-yellow-400" />,
  py: <FileCode className="w-4 h-4 text-green-400" />,
  // Config files
  json: <FileJson className="w-4 h-4 text-yellow-500" />,
  yaml: <FileText className="w-4 h-4 text-red-400" />,
  yml: <FileText className="w-4 h-4 text-red-400" />,
  toml: <FileText className="w-4 h-4 text-orange-400" />,
  // Markup
  html: <FileCode className="w-4 h-4 text-orange-500" />,
  css: <FileCode className="w-4 h-4 text-blue-500" />,
  scss: <FileCode className="w-4 h-4 text-pink-400" />,
  md: <FileText className="w-4 h-4 text-gray-400" />,
  // Images
  png: <FileImage className="w-4 h-4 text-purple-400" />,
  jpg: <FileImage className="w-4 h-4 text-purple-400" />,
  jpeg: <FileImage className="w-4 h-4 text-purple-400" />,
  svg: <FileImage className="w-4 h-4 text-orange-400" />,
  gif: <FileImage className="w-4 h-4 text-purple-400" />,
  // Default
  default: <File className="w-4 h-4 text-gray-500" />,
};

function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
  content?: string;
}

interface FileBrowserProps {
  files: FileNode[];
  onFileSelect?: (file: FileNode) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: FileNode) => void;
}

function FileTreeItem({ node, depth, selectedPath, onSelect }: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const isSelected = selectedPath === node.path;
  const isDirectory = node.type === 'directory';

  const handleClick = () => {
    if (isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      onSelect(node);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-[#2a2a2a] rounded transition-colors",
          isSelected && "bg-[#264f78] hover:bg-[#264f78]"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/collapse icon for directories */}
        {isDirectory ? (
          <span className="w-4 h-4 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-[#888]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#888]" />
            )}
          </span>
        ) : (
          <span className="w-4" />
        )}

        {/* Icon */}
        {isDirectory ? (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 text-yellow-500" />
          ) : (
            <Folder className="w-4 h-4 text-yellow-500" />
          )
        ) : (
          getFileIcon(node.name)
        )}

        {/* Name */}
        <span className={cn(
          "text-sm truncate",
          isDirectory ? "text-[#ccc]" : "text-[#aaa]"
        )}>
          {node.name}
        </span>

        {/* Size for files */}
        {!isDirectory && node.size && (
          <span className="text-xs text-[#666] ml-auto">
            {formatFileSize(node.size)}
          </span>
        )}
      </div>

      {/* Children */}
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
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileBrowser({
  files,
  onFileSelect,
  onRefresh,
  isLoading = false,
  className,
}: FileBrowserProps) {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);

  const handleSelect = (node: FileNode) => {
    if (node.type === 'file') {
      setSelectedFile(node);
      onFileSelect?.(node);
    }
  };

  const handleCopyPath = () => {
    if (selectedFile) {
      navigator.clipboard.writeText(selectedFile.path);
      toast.success('Path copied');
    }
  };

  const handleCopyContent = () => {
    if (selectedFile?.content) {
      navigator.clipboard.writeText(selectedFile.content);
      toast.success('Content copied');
    }
  };

  return (
    <div className={cn("flex flex-col bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#333]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-b border-[#333]">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-[#666]" />
          <span className="text-sm text-[#ccc] font-medium">Files</span>
          <span className="text-xs text-[#666]">
            {countFiles(files)} files
          </span>
        </div>

        <div className="flex items-center gap-1">
          {selectedFile && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-[#666] hover:text-white"
                onClick={handleCopyPath}
                title="Copy path"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              {selectedFile.content && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-[#666] hover:text-white"
                  onClick={handleCopyContent}
                  title="Copy content"
                >
                  <FileText className="w-3.5 h-3.5" />
                </Button>
              )}
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[#666] hover:text-white"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* File tree */}
      <ScrollArea className="flex-1 h-[400px]">
        <div className="py-2">
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Folder className="w-12 h-12 text-[#333] mb-2" />
              <p className="text-[#666] text-sm">No files yet</p>
              <p className="text-[#555] text-xs mt-1">
                Files will appear as the agent creates them
              </p>
            </div>
          ) : (
            files
              .sort((a, b) => {
                if (a.type !== b.type) {
                  return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
              })
              .map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  selectedPath={selectedFile?.path || null}
                  onSelect={handleSelect}
                />
              ))
          )}
        </div>
      </ScrollArea>

      {/* Selected file info */}
      {selectedFile && (
        <div className="px-4 py-2 bg-[#111] border-t border-[#333]">
          <div className="flex items-center gap-2">
            {getFileIcon(selectedFile.name)}
            <span className="text-xs text-[#888] truncate flex-1">
              {selectedFile.path}
            </span>
            {selectedFile.size && (
              <span className="text-xs text-[#666]">
                {formatFileSize(selectedFile.size)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function countFiles(nodes: FileNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'file') {
      count++;
    } else if (node.children) {
      count += countFiles(node.children);
    }
  }
  return count;
}

export default FileBrowser;
