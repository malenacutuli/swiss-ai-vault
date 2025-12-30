import { useState, useCallback } from 'react';
import { Upload, FileImage, FileText } from '@/icons';
import { cn } from '@/lib/utils';

interface GhostDropZoneProps {
  onFilesDropped: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  className?: string;
  children: React.ReactNode;
}

export function GhostDropZone({
  onFilesDropped,
  disabled = false,
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  className,
  children,
}: GhostDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    
    // Only handle file drags, not custom data transfers (like chat-to-folder drags)
    const isFileDrag = e.dataTransfer.types.includes('Files');
    if (!isFileDrag) return;
    
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragActive(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    // Only handle if we're actively tracking a file drag
    if (!isDragActive && dragCounter === 0) return;
    
    e.stopPropagation();
    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragActive(false);
      }
      return newCount;
    });
  }, [isDragActive, dragCounter]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Only prevent default for file drags
    const isFileDrag = e.dataTransfer.types.includes('Files');
    if (!isFileDrag) return;
    
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    // Only handle file drops, not custom data transfers
    const isFileDrag = e.dataTransfer.types.includes('Files');
    if (!isFileDrag) {
      return; // Let other drop handlers (like folder drops) handle this
    }
    
    e.stopPropagation();
    setIsDragActive(false);
    setDragCounter(0);
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Filter valid files
      const validFiles = files.filter(file => {
        // Check size
        if (file.size > maxFileSize) return false;
        
        // Check type
        const isImage = file.type.startsWith('image/');
        const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
        const isText = file.type === 'text/plain' || 
                      file.name.endsWith('.txt') || 
                      file.name.endsWith('.md') ||
                      file.name.endsWith('.csv') ||
                      file.name.endsWith('.json');
        
        return isImage || isPDF || isText;
      });
      
      if (validFiles.length > 0) {
        onFilesDropped(validFiles.slice(0, maxFiles));
      }
    }
  }, [disabled, maxFileSize, maxFiles, onFilesDropped]);

  return (
    <div
      className={cn('relative', className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      
      {/* Overlay when dragging */}
      {isDragActive && !disabled && (
        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-primary rounded-lg">
          <div className="text-center space-y-4 p-8">
            <div className="flex items-center justify-center gap-3 text-primary">
              <FileImage className="h-8 w-8" />
              <Upload className="h-10 w-10 animate-bounce" />
              <FileText className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium text-foreground">
                Drop files here
              </p>
              <p className="text-sm text-muted-foreground">
                Images, PDFs, and documents up to 10MB
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
