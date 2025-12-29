import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Paperclip, X, FileText, Loader2, CheckCircle, AlertCircle, 
  Pause, Play, XCircle, RotateCcw, Clock, Zap, CloudUpload
} from '@/icons';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { 
  useResumableUpload, 
  formatBytes, 
  formatTime, 
  FILE_SIZE_LIMITS,
  type UserTier 
} from '@/hooks/useResumableUpload';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UploadProgress, type ProcessingStage, formatBytes as formatBytesUtil } from './UploadProgress';
import { 
  getFileConfig, 
  getAcceptedFileTypes, 
  getSupportedExtensions,
  type FileHandler 
} from '@/lib/supported-file-types';

interface UploadedDoc {
  filename: string;
  chunkCount: number;
  uploadedAt: Date;
  handler?: FileHandler;
}

interface DocumentUploadProps {
  onUpload: (file: File, onStageChange?: (stage: ProcessingStage, progress: number) => void) => Promise<{ success: boolean; chunkCount: number }>;
  uploadedDocuments: UploadedDoc[];
  onRemoveDocument?: (filename: string) => void;
  isUploading: boolean;
  disabled?: boolean;
  conversationId?: string;
  userId?: string;
  userTier?: UserTier;
  skipStorage?: boolean;
  showDropZone?: boolean; // Show prominent visual drop zone
  maxFiles?: number;
}

type UploadState = 'idle' | 'dragActive' | 'uploading' | 'processing' | 'complete' | 'error';

// Get accepted types from shared config
const ACCEPTED_TYPES = getAcceptedFileTypes();

export function DocumentUpload({
  onUpload,
  uploadedDocuments,
  onRemoveDocument,
  isUploading,
  disabled,
  conversationId,
  userId,
  userTier = 'free',
  skipStorage = false,
  showDropZone = false,
  maxFiles = 20,
}: DocumentUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('uploading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showIncompleteDialog, setShowIncompleteDialog] = useState(false);
  const pendingFileRef = useRef<File | null>(null);

  const maxFileSize = FILE_SIZE_LIMITS[userTier];

  const {
    upload: resumableUpload,
    pause,
    resume,
    cancel,
    resumeFromStored,
    clearIncomplete,
    status: tusStatus,
    progress: tusProgress,
    error: tusError,
    incompleteUploads,
    isLargeFile,
    canPauseResume,
  } = useResumableUpload({
    bucket: 'documents',
    path: userId && conversationId ? `${userId}/${conversationId}` : 'uploads',
    userTier,
    onProgress: (prog) => {
      setUploadProgress(prog.percentage);
    },
    onComplete: async (storagePath) => {
      // After TUS upload completes, process the document
      if (currentFile) {
        setUploadState('processing');
        setProcessingStage('extracting');
        setUploadProgress(40);
        
        const handleStageChange = (stage: ProcessingStage, progress: number) => {
          setProcessingStage(stage);
          setUploadProgress(progress);
        };
        
        try {
          const result = await onUpload(currentFile, handleStageChange);
          if (result.success) {
            setProcessingStage('complete');
            setUploadProgress(100);
            setUploadState('complete');
            setTimeout(() => {
              setUploadState('idle');
              setCurrentFile(null);
              setUploadProgress(0);
              setProcessingStage('uploading');
            }, 1500);
          } else {
            setProcessingStage('error');
            setUploadState('error');
            setErrorMessage('Failed to process document');
            setTimeout(() => {
              setUploadState('idle');
              setErrorMessage(null);
              setProcessingStage('uploading');
            }, 3000);
          }
        } catch (err) {
          setProcessingStage('error');
          setUploadState('error');
          setErrorMessage(err instanceof Error ? err.message : 'Processing failed');
          setTimeout(() => {
            setUploadState('idle');
            setErrorMessage(null);
            setProcessingStage('uploading');
          }, 3000);
        }
      }
    },
    onError: (err) => {
      setUploadState('error');
      setErrorMessage(err.message);
      setTimeout(() => {
        setUploadState('idle');
        setErrorMessage(null);
      }, 5000);
    },
  });

  const validateFile = (file: File): string | null => {
    const fileConfig = getFileConfig(file);
    if (!fileConfig) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';
      return `Unsupported file type: .${ext}`;
    }
    
    if (file.size > maxFileSize) {
      return `File too large. Max size for ${userTier} tier: ${formatBytes(maxFileSize)}`;
    }
    
    return null;
  };

  const handleUpload = useCallback(async (file: File) => {
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

    setCurrentFile(file);
    setUploadProgress(0);
    setIsExpanded(false);

    // Stage callback to update processing stage
    const handleStageChange = (stage: ProcessingStage, progress: number) => {
      setProcessingStage(stage);
      setUploadProgress(progress);
    };

    // OPTIMIZED PATH: Skip storage, send directly to processing
    if (skipStorage) {
      setUploadState('processing');
      setProcessingStage('extracting');
      setUploadProgress(10);
      try {
        const result = await onUpload(file, handleStageChange);
        if (result.success) {
          setProcessingStage('complete');
          setUploadProgress(100);
          setUploadState('complete');
          setTimeout(() => {
            setUploadState('idle');
            setCurrentFile(null);
            setUploadProgress(0);
            setProcessingStage('uploading');
          }, 1500);
        } else {
          setProcessingStage('error');
          setUploadState('error');
          setErrorMessage('Failed to process document');
          setTimeout(() => {
            setUploadState('idle');
            setErrorMessage(null);
            setProcessingStage('uploading');
          }, 3000);
        }
      } catch (error) {
        setProcessingStage('error');
        setUploadState('error');
        setErrorMessage(error instanceof Error ? error.message : 'Processing failed');
        setTimeout(() => {
          setUploadState('idle');
          setErrorMessage(null);
          setProcessingStage('uploading');
        }, 3000);
      }
      return;
    }

    // STORAGE PATH: For large files, use TUS resumable upload
    if (isLargeFile(file)) {
      setUploadState('uploading');
      setProcessingStage('uploading');
      try {
        await resumableUpload(file);
      } catch (err) {
        // Error handled by onError callback
      }
    } else {
      // For small files, use standard upload flow with stage tracking
      setUploadState('uploading');
      setProcessingStage('uploading');
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 15, 30));
      }, 100);

      try {
        clearInterval(progressInterval);
        setUploadProgress(35);
        setProcessingStage('extracting');
        setUploadState('processing');
        
        const result = await onUpload(file, handleStageChange);

        if (result.success) {
          setProcessingStage('complete');
          setUploadProgress(100);
          setUploadState('complete');
          setTimeout(() => {
            setUploadState('idle');
            setCurrentFile(null);
            setUploadProgress(0);
            setProcessingStage('uploading');
          }, 1500);
        } else {
          setProcessingStage('error');
          setUploadState('error');
          setErrorMessage('Failed to process document');
          setTimeout(() => {
            setUploadState('idle');
            setErrorMessage(null);
            setProcessingStage('uploading');
          }, 3000);
        }
      } catch (error) {
        clearInterval(progressInterval);
        setProcessingStage('error');
        setUploadState('error');
        setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
        setTimeout(() => {
          setUploadState('idle');
          setErrorMessage(null);
          setProcessingStage('uploading');
        }, 3000);
      }
    }
  }, [onUpload, isLargeFile, resumableUpload, maxFileSize, userTier, skipStorage]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0 || disabled) return;

    // Process files sequentially
    for (const file of acceptedFiles) {
      // Check for incomplete uploads matching this file
      const matchingIncomplete = incompleteUploads.find(
        u => u.filename === file.name && u.bytesTotal === file.size
      );

      if (matchingIncomplete) {
        pendingFileRef.current = file;
        setShowIncompleteDialog(true);
        return;
      }

      await handleUpload(file);
    }
  }, [handleUpload, disabled, incompleteUploads]);

  const handleResumeIncomplete = async () => {
    const file = pendingFileRef.current;
    if (!file) return;

    const matchingIncomplete = incompleteUploads.find(
      u => u.filename === file.name && u.bytesTotal === file.size
    );

    if (matchingIncomplete) {
      setShowIncompleteDialog(false);
      setCurrentFile(file);
      setUploadState('uploading');
      try {
        await resumeFromStored(matchingIncomplete, file);
      } catch (err) {
        // Error handled by callback
      }
    }
    pendingFileRef.current = null;
  };

  const handleStartFresh = () => {
    const file = pendingFileRef.current;
    if (!file) return;

    const matchingIncomplete = incompleteUploads.find(
      u => u.filename === file.name
    );

    if (matchingIncomplete) {
      clearIncomplete(matchingIncomplete.id);
    }

    setShowIncompleteDialog(false);
    handleUpload(file);
    pendingFileRef.current = null;
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles,
    noClick: !showDropZone,
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

  const getFileIcon = () => {
    return <FileText className="h-3 w-3" />;
  };

  const isUsingTUS = currentFile && isLargeFile(currentFile);
  const showPauseResume = currentFile && canPauseResume(currentFile);

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
                    {getFileIcon()}
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
        
        {/* Prominent Visual Drop Zone */}
        {showDropZone && uploadState === 'idle' && (
          <div className={cn(
            "p-8 border-2 border-dashed rounded-xl cursor-pointer",
            "flex flex-col items-center justify-center gap-3",
            "bg-muted/30 hover:bg-muted/50 transition-all duration-200",
            isDragActive 
              ? "border-primary bg-primary/10 scale-[1.02]" 
              : "border-border hover:border-primary/50"
          )}>
            <div className={cn(
              "p-4 rounded-full transition-colors",
              isDragActive ? "bg-primary/20" : "bg-muted"
            )}>
              <CloudUpload className={cn(
                "h-8 w-8 transition-colors",
                isDragActive ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {isDragActive ? "Drop files here" : "Drop files here or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, DOCX, PPTX, XLSX, images, code files • Up to {maxFiles} files • Max {formatBytes(maxFileSize)} each
              </p>
            </div>
          </div>
        )}

        {/* Compact Expanded Drop Zone (hover state for button mode) */}
        {!showDropZone && (isExpanded || isDragActive) && uploadState === 'idle' && (
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
            <CloudUpload className={cn(
              "h-8 w-8",
              isDragActive ? "text-primary" : "text-muted-foreground"
            )} />
            <p className="text-sm font-medium">
              {isDragActive ? "Drop files here" : "Drop files here or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, DOCX, PPTX, XLSX, TXT, MD, CSV, JSON, images & code • Max {formatBytes(maxFileSize)}
            </p>
          </div>
        )}

        {/* Large File Upload Progress */}
        {(uploadState === 'uploading' || tusStatus === 'uploading' || tusStatus === 'paused' || tusStatus === 'resuming') && currentFile && isUsingTUS && (
          <div className="p-4 bg-card rounded-lg border border-border mb-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {currentFile.name}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatBytes(currentFile.size)}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {tusStatus === 'paused' ? 'Paused' : 
                   tusStatus === 'resuming' ? 'Resuming...' :
                   `Uploading chunk ${tusProgress.currentChunk} of ${tusProgress.totalChunks}`}
                </span>
                <span className="font-medium">{tusProgress.percentage}%</span>
              </div>
              <Progress value={tusProgress.percentage} className="h-2" />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span>{formatBytes(tusProgress.speed)}/s</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatTime(tusProgress.estimatedTimeRemaining)} remaining</span>
              </div>
            </div>

            {/* Controls */}
            {showPauseResume && (
              <div className="flex items-center gap-2">
                {tusStatus === 'paused' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resume}
                    className="flex items-center gap-1"
                  >
                    <Play className="h-3 w-3" />
                    Resume
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={pause}
                    className="flex items-center gap-1"
                  >
                    <Pause className="h-3 w-3" />
                    Pause
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    cancel();
                    setUploadState('idle');
                    setCurrentFile(null);
                  }}
                  className="flex items-center gap-1 text-destructive hover:text-destructive"
                >
                  <XCircle className="h-3 w-3" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Processing Progress with Stage Indicator (small files / direct processing) */}
        {(uploadState === 'uploading' || uploadState === 'processing' || uploadState === 'complete') && currentFile && !isUsingTUS && (
          <div className="mb-2">
            <UploadProgress
              progress={uploadProgress}
              stage={processingStage}
              fileName={currentFile.name}
              fileSize={formatBytes(currentFile.size)}
              error={errorMessage || undefined}
            />
          </div>
        )}

        {/* Error State */}
        {(uploadState === 'error' || tusStatus === 'error') && (errorMessage || tusError) && (
          <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20 mb-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm font-medium text-destructive">
              {errorMessage || tusError?.message}
            </p>
          </div>
        )}

        {/* Incomplete Uploads Indicator */}
        {incompleteUploads.length > 0 && uploadState === 'idle' && (
          <div className="flex items-center gap-3 p-3 bg-warning/10 rounded-lg border border-warning/20 mb-2">
            <RotateCcw className="h-4 w-4 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning">
                {incompleteUploads.length} incomplete upload{incompleteUploads.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                Drop the same file to resume
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => incompleteUploads.forEach(u => clearIncomplete(u.id))}
              className="text-xs"
            >
              Clear all
            </Button>
          </div>
        )}

        {/* Paperclip Button (only show in compact mode) */}
        {!showDropZone && (
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
                  {isUploading || tusStatus === 'uploading' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Upload document for context</p>
                <p className="text-xs text-muted-foreground">
                  PDF, DOCX, PPTX, TXT, MD • Max {formatBytes(maxFileSize)}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Resume Incomplete Upload Dialog */}
      <Dialog open={showIncompleteDialog} onOpenChange={setShowIncompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resume Previous Upload?</DialogTitle>
            <DialogDescription>
              We found an incomplete upload for "{pendingFileRef.current?.name}". 
              Would you like to resume where you left off or start fresh?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleResumeIncomplete} className="flex-1">
              <RotateCcw className="h-4 w-4 mr-2" />
              Resume Upload
            </Button>
            <Button variant="outline" onClick={handleStartFresh} className="flex-1">
              Start Fresh
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
