import { useState, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FolderOpen
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

interface FileToUpload {
  file: File;
  content?: string;
  status: 'pending' | 'reading' | 'uploading' | 'success' | 'error';
  error?: string;
  chunksAdded?: number;
}

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Array<{ id: string; name: string }>;
  onUpload: (
    files: Array<{ content: string; filename: string }>,
    folderId?: string
  ) => Promise<{ successful: number; failed: number }>;
}

export function BulkUploadDialog({
  open,
  onOpenChange,
  folders,
  onUpload
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
      status: 'pending' as const
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
    
    for (const fileObj of newFiles) {
      try {
        setFiles(prev => prev.map(f => 
          f.file === fileObj.file ? { ...f, status: 'reading' } : f
        ));
        
        const content = await fileObj.file.text();
        
        setFiles(prev => prev.map(f => 
          f.file === fileObj.file ? { ...f, content, status: 'pending' } : f
        ));
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.file === fileObj.file ? { ...f, status: 'error', error: 'Failed to read file' } : f
        ));
      }
    }
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/json': ['.json'],
      'text/csv': ['.csv']
    },
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
          </DialogTitle>
          <DialogDescription>
            Upload multiple documents to your AI memory. Supported formats: .txt, .md, .json, .csv
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
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm truncate">{f.file.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {f.status === 'reading' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        {f.status === 'uploading' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        {f.status === 'success' && <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />}
                        {f.status === 'error' && <AlertCircle className="h-3 w-3 mr-1 text-destructive" />}
                        {f.status}
                      </Badge>
                      {f.status === 'pending' && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(f.file)}>
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
              <Button onClick={handleUpload} disabled={isUploading || pendingCount === 0}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Uploading...
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
