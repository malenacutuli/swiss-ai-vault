import { X, FileText, Image, FileSpreadsheet, Presentation, File, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'encrypting' | 'processing' | 'ready' | 'error';
  progress?: number;
  error?: string;
}

interface FileAttachmentProps {
  files: AttachedFile[];
  onRemove: (id: string) => void;
  className?: string;
}

const FILE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  ppt: Presentation,
  pptx: Presentation,
  png: Image,
  jpg: Image,
  jpeg: Image,
  gif: Image,
};

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileAttachment({ files, onRemove, className }: FileAttachmentProps) {
  if (files.length === 0) return null;
  
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {files.map((file) => {
        const Icon = getFileIcon(file.name);
        const isProcessing = ['uploading', 'encrypting', 'processing'].includes(file.status);
        
        return (
          <div
            key={file.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50",
              file.status === 'error' && "border-destructive/50 bg-destructive/10",
              isProcessing && "animate-pulse"
            )}
          >
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate max-w-[150px]">
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
            
            {/* Status indicator */}
            {file.status === 'encrypting' && (
              <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Lock className="h-3 w-3 animate-pulse" />
                <span>Encrypting...</span>
              </div>
            )}
            
            {file.status === 'processing' && (
              <div className="flex items-center gap-1 text-xs text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Processing...</span>
              </div>
            )}
            
            {file.status === 'uploading' && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{file.progress || 0}%</span>
              </div>
            )}
            
            {file.status === 'error' && (
              <span className="text-xs text-destructive">
                {file.error || 'Error'}
              </span>
            )}
            
            {/* Remove button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => onRemove(file.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export type { AttachedFile };
