import { useState, useCallback, useEffect } from 'react';
import { CloudUpload, FileText, Image, Code, Table } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFileConfig } from '@/lib/supported-file-types';

interface FullWindowDropZoneProps {
  onFilesDropped: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
}

export function FullWindowDropZone({
  onFilesDropped,
  disabled = false,
  maxFiles = 20,
  maxFileSize = 100 * 1024 * 1024, // 100MB
}: FullWindowDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    setDragCounter(prev => prev + 1);
    
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragOver(false);
      }
      return newCount;
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragOver(false);
    setDragCounter(0);
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer?.files || []);
    
    // Filter valid files
    const validFiles = files.filter(file => {
      const config = getFileConfig(file);
      if (!config) {
        console.warn(`Unsupported file type: ${file.name}`);
        return false;
      }
      if (file.size > maxFileSize) {
        console.warn(`File too large: ${file.name}`);
        return false;
      }
      return true;
    }).slice(0, maxFiles);
    
    if (validFiles.length > 0) {
      onFilesDropped(validFiles);
    }
  }, [disabled, maxFiles, maxFileSize, onFilesDropped]);

  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  if (!isDragOver) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm",
        "flex items-center justify-center",
        "animate-in fade-in duration-200"
      )}
    >
      <div className={cn(
        "m-8 w-full h-full max-w-4xl max-h-[80vh]",
        "border-4 border-dashed border-primary rounded-2xl",
        "bg-primary/5 flex flex-col items-center justify-center gap-6",
        "animate-in zoom-in-95 duration-200"
      )}>
        <div className="p-6 rounded-full bg-primary/10">
          <CloudUpload className="h-16 w-16 text-primary" />
        </div>
        
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Drop files here</h2>
          <p className="text-muted-foreground">
            Up to {maxFiles} files • Max {Math.round(maxFileSize / 1024 / 1024)}MB each
          </p>
        </div>

        <div className="flex flex-wrap gap-4 justify-center px-8">
          <FileTypeChip icon={FileText} label="Documents" types="PDF, DOCX, PPTX, TXT" />
          <FileTypeChip icon={Table} label="Data" types="CSV, XLSX, JSON" />
          <FileTypeChip icon={Code} label="Code" types="JS, TS, PY, and 20+ more" />
          <FileTypeChip icon={Image} label="Images" types="PNG, JPG, WEBP, GIF" />
        </div>
      </div>
    </div>
  );
}

function FileTypeChip({ 
  icon: Icon, 
  label, 
  types 
}: { 
  icon: React.ElementType; 
  label: string; 
  types: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-background/80 rounded-full border border-border">
      <Icon className="h-4 w-4 text-primary" />
      <div className="text-left">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{types}</p>
      </div>
    </div>
  );
}
