import React, { useState, useEffect } from 'react';
import {
  X,
  Folder,
  File,
  FileText,
  FileCode,
  Image,
  Download,
  ChevronRight,
  ChevronDown,
  Home,
  RefreshCw,
  Search,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  mimeType?: string;
  modifiedAt?: string;
  path: string;
  children?: FileItem[];
}

interface FileManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileItem[];
  currentPath: string;
  isLoading?: boolean;
  onNavigate?: (path: string) => void;
  onDownload?: (file: FileItem) => void;
  onPreview?: (file: FileItem) => void;
}

const getFileIcon = (file: FileItem) => {
  if (file.type === 'folder') {
    return <Folder className="w-5 h-5 text-blue-500" />;
  }

  const ext = file.name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'js':
    case 'ts':
    case 'tsx':
    case 'jsx':
    case 'py':
    case 'java':
    case 'cpp':
    case 'c':
    case 'go':
    case 'rs':
    case 'json':
    case 'yaml':
    case 'yml':
    case 'html':
    case 'css':
    case 'scss':
      return <FileCode className="w-5 h-5 text-emerald-500" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image className="w-5 h-5 text-purple-500" />;
    case 'md':
    case 'txt':
    case 'doc':
    case 'docx':
    case 'pdf':
      return <FileText className="w-5 h-5 text-orange-500" />;
    default:
      return <File className="w-5 h-5 text-gray-500" />;
  }
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const FileManagementModal: React.FC<FileManagementModalProps> = ({
  isOpen,
  onClose,
  files,
  currentPath,
  isLoading = false,
  onNavigate,
  onDownload,
  onPreview,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pathParts = currentPath.split('/').filter(Boolean);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleFileClick = (file: FileItem) => {
    if (file.type === 'folder') {
      toggleFolder(file.id);
      onNavigate?.(file.path);
    } else {
      setSelectedFile(file);
      onPreview?.(file);
    }
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFileTree = (items: FileItem[], depth = 0) => {
    return items.map(file => {
      const isExpanded = expandedFolders.has(file.id);
      const isSelected = selectedFile?.id === file.id;

      return (
        <div key={file.id}>
          <div
            onClick={() => handleFileClick(file)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
              "hover:bg-gray-100",
              isSelected && "bg-blue-50 border-l-2 border-blue-500",
              !isSelected && "border-l-2 border-transparent"
            )}
            style={{ paddingLeft: `${12 + depth * 20}px` }}
          >
            {file.type === 'folder' && (
              <button className="p-0.5 hover:bg-gray-200 rounded">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
            )}
            {file.type !== 'folder' && <div className="w-5" />}

            {getFileIcon(file)}

            <span className={cn(
              "flex-1 truncate text-sm",
              file.type === 'folder' ? "font-medium text-gray-900" : "text-gray-700"
            )}>
              {file.name}
            </span>

            <span className="text-xs text-gray-400 hidden sm:block">
              {formatFileSize(file.size)}
            </span>

            <span className="text-xs text-gray-400 hidden md:block">
              {formatDate(file.modifiedAt)}
            </span>

            {file.type === 'file' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload?.(file);
                }}
                className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title="Download"
              >
                <Download className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>

          {file.type === 'folder' && isExpanded && file.children && (
            <div className="border-l border-gray-200 ml-6">
              {renderFileTree(file.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <Folder className="w-5 h-5 text-blue-500" />
            <span className="font-medium text-gray-900">File Manager</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh */}
            <button
              onClick={() => onNavigate?.(currentPath)}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn(
                "w-5 h-5 text-gray-500",
                isLoading && "animate-spin"
              )} />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Breadcrumb Path */}
        <div className="px-6 py-3 border-b bg-gray-100/50">
          <div className="flex items-center gap-1 text-sm overflow-x-auto">
            <button
              onClick={() => onNavigate?.('/')}
              className="flex items-center gap-1 px-2 py-1 hover:bg-gray-200 rounded transition-colors text-gray-600"
            >
              <Home className="w-4 h-4" />
            </button>

            {pathParts.map((part, index) => (
              <React.Fragment key={index}>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <button
                  onClick={() => onNavigate?.('/' + pathParts.slice(0, index + 1).join('/'))}
                  className={cn(
                    "px-2 py-1 rounded transition-colors truncate max-w-[150px]",
                    index === pathParts.length - 1
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : "hover:bg-gray-200 text-gray-600"
                  )}
                >
                  {part}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                <p className="text-gray-600">Loading files...</p>
              </div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>{searchQuery ? 'No files match your search' : 'No files in this directory'}</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {/* Column Headers */}
              <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 text-xs text-gray-500 uppercase font-medium sticky top-0">
                <div className="w-5" />
                <div className="w-5" />
                <span className="flex-1">Name</span>
                <span className="w-20 hidden sm:block text-right">Size</span>
                <span className="w-32 hidden md:block text-right">Modified</span>
                <span className="w-8" />
              </div>

              {renderFileTree(filteredFiles)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-between text-sm text-gray-600">
          <span>
            {filteredFiles.length} {filteredFiles.length === 1 ? 'item' : 'items'}
            {searchQuery && ` matching "${searchQuery}"`}
          </span>

          {selectedFile && (
            <div className="flex items-center gap-3">
              <span className="text-gray-500">Selected:</span>
              <span className="font-medium text-gray-700">{selectedFile.name}</span>
              {selectedFile.type === 'file' && (
                <>
                  <button
                    onClick={() => onDownload?.(selectedFile)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={() => onPreview?.(selectedFile)}
                    className="flex items-center gap-1 px-3 py-1.5 border rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Preview
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileManagementModal;
