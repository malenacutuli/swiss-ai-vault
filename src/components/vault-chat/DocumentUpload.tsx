import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Paperclip, X, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface UploadedDoc {
  filename: string;
  chunkCount: number;
  uploadedAt: Date;
}

interface DocumentUploadProps {
  onUpload: (file: File) => Promise<{ success: boolean; chunkCount: number }>;
  uploadedDocuments: UploadedDoc[];
  onRemoveDocument?: (filename: string) => void;
  isUploading: boolean;
  disabled?: boolean;
}

type UploadState = 'idle' | 'dragActive' | 'uploading' | 'processing' | 'complete' | 'error';

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
};

const MAX_FILE_SIZES: Record<string, number> = {
  pdf: 500 * 1024 * 1024,
  docx: 100 * 1024 * 1024,
  pptx: 500 * 1024 * 1024,
  txt: 100 * 1024 * 1024,
  md: 100 * 1024 * 1024,
};

export function DocumentUpload({
  onUpload,
  uploadedDocuments,
  onRemoveDocument,
  isUploading,
  disabled,
}: DocumentUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const validateFile = (file: File): string | null => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension) return 'Invalid file type';
    
    const maxSize = MAX_FILE_SIZES[extension];
    if (!maxSize) return `Unsupported file type: .${extension}`;
    
    if (file.size > maxSize) {
      return `File too large. Max size for .${extension}: ${Math.round(maxSize / (1024 * 1024))}MB`;
    }
    
    return null;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0 || disabled) return;

    const file = acceptedFiles[0];
    const validationError = validateFile(file);
    
    if (validationError) {
      setErrorMessage(validationError);
      setUploadState('error');
      setTimeout(() => {
        setUploadState('idle');
        setErrorMessage(null);
      }, 3000);
      return;
    }

    setCurrentFile(file.name);
    setUploadState('uploading');
    setUploadProgress(0);
    setIsExpanded(false);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      setUploadState('processing');
      const result = await onUpload(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success) {
        setUploadState('complete');
        setTimeout(() => {
          setUploadState('idle');
          setCurrentFile(null);
          setUploadProgress(0);
        }, 1500);
      } else {
        setUploadState('error');
        setErrorMessage('Failed to process document');
        setTimeout(() => {
          setUploadState('idle');
          setErrorMessage(null);
        }, 3000);
      }
    } catch (error) {
      clearInterval(progressInterval);
      setUploadState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
      setTimeout(() => {
        setUploadState('idle');
        setErrorMessage(null);
      }, 3000);
    }
  }, [onUpload, disabled]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    noClick: true,
    noKeyboard: disabled,
    disabled,
    onDragEnter: () => setIsExpanded(true),
    onDragLeave: () => setIsExpanded(false),
  });

  const truncateFilename = (name: string, maxLength = 20) => {
    if (name.length <= maxLength) return name;
    const extension = name.split('.').pop();
    const nameWithoutExt = name.slice(0, name.lastIndexOf('.'));
    const truncated = nameWithoutExt.slice(0, maxLength - 3 - (extension?.length || 0));
    return `${truncated}...${extension}`;
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return <FileText className="h-3 w-3" />;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Uploaded Documents */}
      {uploadedDocuments.length > 0 && (
        <div className="flex gap-2 flex-wrap max-w-full overflow-x-auto pb-1">
          {uploadedDocuments.map((doc, idx) => (
            <TooltipProvider key={idx}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-full",
                    "bg-success/10 border border-success/20",
                    "text-xs text-success"
                  )}>
                    {getFileIcon(doc.filename)}
                    <span className="max-w-[100px] truncate">{truncateFilename(doc.filename)}</span>
                    {onRemoveDocument && (
                      <button
                        onClick={() => onRemoveDocument(doc.filename)}
                        className="ml-1 hover:text-destructive transition-colors"
                        aria-label={`Remove ${doc.filename}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{doc.filename}</p>
                  <p className="text-xs text-muted-foreground">{doc.chunkCount} chunks indexed</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      )}

      {/* Upload Area */}
      <div {...getRootProps()} className="relative">
        <input {...getInputProps()} aria-label="Upload document" />
        
        {/* Expanded Drop Zone */}
        {(isExpanded || isDragActive) && uploadState === 'idle' && (
          <div className={cn(
            "absolute bottom-full left-0 right-0 mb-2 p-6",
            "border-2 border-dashed rounded-lg",
            "flex flex-col items-center justify-center gap-2",
            "bg-card/95 backdrop-blur-sm",
            "animate-fade-in",
            isDragActive 
              ? "border-primary bg-primary/5" 
              : "border-border"
          )}>
            <FileText className={cn(
              "h-8 w-8",
              isDragActive ? "text-primary" : "text-muted-foreground"
            )} />
            <p className="text-sm font-medium">
              {isDragActive ? "Drop file here" : "Drop files here or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, DOCX, PPTX, TXT, MD
            </p>
          </div>
        )}

        {/* Upload Progress */}
        {(uploadState === 'uploading' || uploadState === 'processing') && currentFile && (
          <div className="flex items-center gap-3 p-3 bg-info/10 rounded-lg border border-info/20 mb-2">
            <Loader2 className="h-4 w-4 text-info animate-spin" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentFile}</p>
              <p className="text-xs text-muted-foreground">
                {uploadState === 'processing' ? 'Analyzing document...' : 'Uploading...'}
              </p>
              <Progress value={uploadProgress} className="h-1 mt-1" />
            </div>
          </div>
        )}

        {/* Complete State */}
        {uploadState === 'complete' && currentFile && (
          <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/20 mb-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <p className="text-sm font-medium text-success">
              {currentFile} uploaded successfully
            </p>
          </div>
        )}

        {/* Error State */}
        {uploadState === 'error' && errorMessage && (
          <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20 mb-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm font-medium text-destructive">{errorMessage}</p>
          </div>
        )}

        {/* Paperclip Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (!disabled && uploadState === 'idle') {
                    open();
                  }
                }}
                disabled={disabled || isUploading || uploadState !== 'idle'}
                className={cn(
                  "h-9 w-9 shrink-0",
                  uploadedDocuments.length > 0 && "text-success"
                )}
                aria-label="Upload document"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Upload document for context</p>
              <p className="text-xs text-muted-foreground">PDF, DOCX, PPTX, TXT, MD</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
