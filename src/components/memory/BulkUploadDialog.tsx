import { useState, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FolderOpen,
  FileSpreadsheet,
  Presentation,
  FileType
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { 
  processDocument, 
  getAcceptedFileTypes, 
  getSupportedFormatsText,
  detectFileType,
  type SupportedFileType
} from '@/lib/memory/document-processor';

interface FileToUpload {
  file: File;
  content?: string;
  status: 'pending' | 'extracting' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
  chunksAdded?: number;
  metadata?: {
    fileType: SupportedFileType;
    pageCount?: number;
    slideCount?: number;
    sheetCount?: number;
    wordCount?: number;
  };
}

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Array<{ id: string; name: string }>;
  onUpload: (
    files: Array<{ content: string; filename: string }>,
    folderId?: string
  ) => Promise<{ successful: number; failed: number }>;
  onUploadComplete?: () => void;
}

function getFileIcon(fileType: SupportedFileType) {
  switch (fileType) {
    case 'xlsx':
      return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    case 'pptx':
      return <Presentation className="h-4 w-4 text-orange-600" />;
    case 'pdf':
      return <FileType className="h-4 w-4 text-red-600" />;
    case 'docx':
      return <FileText className="h-4 w-4 text-blue-600" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

export function BulkUploadDialog({
  open,
  onOpenChange,
  folders,
  onUpload,
  onUploadComplete
}: BulkUploadDialogProps) {
  const [files, setFiles] = useState<FileToUpload[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('none');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadComplete, setUploadComplete] = useState(false);
  const [results, setResults] = useState<{ successful: number; failed: number } | null>(null);
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: FileToUpload[] = acceptedFiles.map(file => ({
      file,
      status: 'pending' as const,
      metadata: { fileType: detectFileType(file) }
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
    
    // Process each file to extract content
    for (const fileObj of newFiles) {
      try {
        setFiles(prev => prev.map(f => 
          f.file === fileObj.file ? { ...f, status: 'extracting', progress: 0 } : f
        ));
        
        const result = await processDocument(fileObj.file, (progress) => {
          setFiles(prev => prev.map(f => 
            f.file === fileObj.file ? { 
              ...f, 
              status: progress.stage === 'complete' ? 'pending' : 'extracting',
              progress: progress.percent 
            } : f
          ));
        });
        
        if (result.success) {
          setFiles(prev => prev.map(f => 
            f.file === fileObj.file ? { 
              ...f, 
              content: result.content, 
              status: 'pending',
              progress: undefined,
              metadata: {
                fileType: result.metadata.fileType,
                pageCount: result.metadata.pageCount,
                slideCount: result.metadata.slideCount,
                sheetCount: result.metadata.sheetCount,
                wordCount: result.metadata.wordCount
              }
            } : f
          ));
        } else {
          setFiles(prev => prev.map(f => 
            f.file === fileObj.file ? { 
              ...f, 
              status: 'error', 
              progress: undefined,
              error: result.error || 'Extraction failed' 
            } : f
          ));
        }
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.file === fileObj.file ? { 
            ...f, 
            status: 'error', 
            progress: undefined,
            error: error instanceof Error ? error.message : 'Unknown error' 
          } : f
        ));
      }
    }
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: getAcceptedFileTypes(),
    multiple: true
  });
  
  const removeFile = (file: File) => {
    setFiles(prev => prev.filter(f => f.file !== file));
  };
  
  const handleUpload = async () => {
    const readyFiles = files.filter(f => f.status === 'pending' && f.content);
    if (readyFiles.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress({ current: 0, total: readyFiles.length });
    
    try {
      setFiles(prev => prev.map(f => 
        f.status === 'pending' ? { ...f, status: 'uploading' } : f
      ));
      
      const filesToUpload = readyFiles.map(f => ({
        content: f.content!,
        filename: f.file.name
      }));
      
      const folderId = selectedFolder === 'none' ? undefined : selectedFolder;
      const result = await onUpload(filesToUpload, folderId);
      
      setFiles(prev => prev.map(f => 
        f.status === 'uploading' ? { ...f, status: 'success' } : f
      ));
      
      setResults(result);
      setUploadComplete(true);
      onUploadComplete?.();
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.status === 'uploading' ? { ...f, status: 'error', error: 'Upload failed' } : f
      ));
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleClose = () => {
    setFiles([]);
    setSelectedFolder('none');
    setUploadComplete(false);
    setResults(null);
    onOpenChange(false);
  };
  
  const pendingCount = files.filter(f => f.status === 'pending' && f.content).length;
  const extractingCount = files.filter(f => f.status === 'extracting').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
          </DialogTitle>
          <DialogDescription>
            Supported: {getSupportedFormatsText()}
          </DialogDescription>
        </DialogHeader>
        
        {!uploadComplete ? (
          <>
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-sm text-foreground">Drop files here...</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Drag & drop files here, or click to select
                </p>
              )}
            </div>
            
            {/* Folder Selection */}
            {files.length > 0 && (
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select folder" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border z-50">
                    <SelectItem value="none">No folder (root)</SelectItem>
                    {folders.map(folder => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* File List */}
            {files.length > 0 && (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                      {f.metadata?.fileType ? getFileIcon(f.metadata.fileType) : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block">{f.file.name}</span>
                        {f.metadata && f.status === 'pending' && (
                          <span className="text-xs text-muted-foreground">
                            {f.metadata.pageCount && `${f.metadata.pageCount} pages • `}
                            {f.metadata.slideCount && `${f.metadata.slideCount} slides • `}
                            {f.metadata.sheetCount && `${f.metadata.sheetCount} sheets • `}
                            {f.metadata.wordCount && `${f.metadata.wordCount.toLocaleString()} words`}
                          </span>
                        )}
                        {f.status === 'extracting' && f.progress !== undefined && (
                          <Progress value={f.progress} className="h-1 mt-1" />
                        )}
                        {f.status === 'error' && f.error && (
                          <span className="text-xs text-destructive">{f.error}</span>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {f.status === 'extracting' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        {f.status === 'uploading' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        {f.status === 'success' && <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />}
                        {f.status === 'error' && <AlertCircle className="h-3 w-3 mr-1 text-destructive" />}
                        {f.status === 'extracting' ? 'extracting' : f.status}
                      </Badge>
                      {(f.status === 'pending' || f.status === 'error') && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeFile(f.file)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            
            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <Progress value={(uploadProgress.current / uploadProgress.total) * 100} />
                <p className="text-xs text-muted-foreground text-center">
                  Uploading {uploadProgress.current} of {uploadProgress.total}...
                </p>
              </div>
            )}
          </>
        ) : (
          /* Upload Complete */
          <div className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-medium mb-2">Upload Complete</h3>
            <p className="text-sm text-muted-foreground">
              {results?.successful} of {files.length} documents added to memory
            </p>
            {results?.failed && results.failed > 0 && (
              <p className="text-sm text-destructive mt-1">
                {results.failed} failed
              </p>
            )}
          </div>
        )}
        
        <DialogFooter>
          {!uploadComplete ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={isUploading || pendingCount === 0 || extractingCount > 0}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
                  </>
                ) : extractingCount > 0 ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {pendingCount} File{pendingCount !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
