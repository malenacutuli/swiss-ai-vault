import React, { useState, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import { 
  Download, 
  Edit3, 
  Eye, 
  GitCompare, 
  Copy, 
  Check,
  FileCode,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CodeEditor, detectLanguage } from './CodeEditor';
import { FileBrowser, buildFileTree, type FileNode } from './FileBrowser';
import { cn } from '@/lib/utils';

interface GeneratedFile {
  path: string;
  content: string;
  originalContent?: string;
  size?: number;
  mimeType?: string;
}

interface FileViewerPanelProps {
  files: GeneratedFile[];
  className?: string;
  isExecuting?: boolean;
}

export function FileViewerPanel({
  files,
  className,
  isExecuting = false,
}: FileViewerPanelProps) {
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'edit' | 'diff'>('view');
  const [editedContent, setEditedContent] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Build file tree structure
  const fileTree = useMemo(() => {
    return buildFileTree(files.map(f => ({ path: f.path, size: f.size || f.content.length })));
  }, [files]);

  // Handle file selection
  const handleSelectFile = useCallback((node: FileNode) => {
    const file = files.find(f => f.path === node.path);
    if (file) {
      setSelectedFile(file);
      setEditedContent(file.content);
      setViewMode(file.originalContent ? 'diff' : 'view');
    }
  }, [files]);

  // Handle single file download
  const handleDownloadFile = useCallback((node: FileNode) => {
    const file = files.find(f => f.path === node.path);
    if (!file) return;

    const blob = new Blob([file.content], { type: file.mimeType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = node.name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${node.name}`);
  }, [files]);

  // Handle download all as ZIP
  const handleDownloadAll = useCallback(async () => {
    if (files.length === 0) return;

    const zip = new JSZip();
    
    for (const file of files) {
      zip.file(file.path, file.content);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-files.zip';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded all files as ZIP');
  }, [files]);

  // Copy content to clipboard
  const handleCopy = useCallback(async () => {
    if (!selectedFile) return;
    
    await navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  }, [selectedFile]);

  // Auto-select first file
  React.useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      const firstFile = files[0];
      setSelectedFile(firstFile);
      setEditedContent(firstFile.content);
    }
  }, [files, selectedFile]);

  const currentLanguage = selectedFile ? detectLanguage(selectedFile.path) : 'plaintext';
  const hasChanges = selectedFile?.originalContent !== undefined;

  return (
    <div className={cn(
      'flex border border-border rounded-lg overflow-hidden bg-background',
      isFullscreen && 'fixed inset-4 z-50 shadow-2xl',
      className
    )}>
      {/* File browser sidebar */}
      <div className="w-64 border-r border-border flex-shrink-0">
        <FileBrowser
          files={fileTree}
          selectedPath={selectedFile?.path}
          onSelect={handleSelectFile}
          onDownload={handleDownloadFile}
          onDownloadAll={handleDownloadAll}
        />
      </div>

      {/* Editor panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedFile ? (
          <>
            {/* Editor toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium truncate">
                  {selectedFile.path}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {currentLanguage}
                </Badge>
                {hasChanges && (
                  <Badge variant="outline" className="text-xs">
                    Modified
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* View mode tabs */}
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="view" className="h-6 px-2 text-xs">
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </TabsTrigger>
                    {hasChanges && (
                      <TabsTrigger value="diff" className="h-6 px-2 text-xs">
                        <GitCompare className="h-3 w-3 mr-1" />
                        Diff
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="edit" className="h-6 px-2 text-xs">
                      <Edit3 className="h-3 w-3 mr-1" />
                      Edit
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="w-px h-4 bg-border mx-1" />

                {/* Copy button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>

                {/* Download button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleDownloadFile({ 
                    name: selectedFile.path.split('/').pop() || 'file', 
                    path: selectedFile.path, 
                    type: 'file' 
                  })}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>

                {/* Fullscreen toggle */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Editor content */}
            <div className="flex-1 min-h-0">
              <CodeEditor
                content={viewMode === 'edit' ? editedContent : selectedFile.content}
                filename={selectedFile.path}
                readOnly={viewMode !== 'edit'}
                onChange={setEditedContent}
                originalContent={viewMode === 'diff' ? selectedFile.originalContent : undefined}
                height="100%"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileCode className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {files.length === 0 
                  ? (isExecuting ? 'Files will appear here as they are generated...' : 'No files generated')
                  : 'Select a file to view'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export types for external use
export type { GeneratedFile };
