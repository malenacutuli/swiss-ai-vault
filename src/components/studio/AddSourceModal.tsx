import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Link, FileText, Loader2, X, CheckCircle2, Image, Mic, Youtube } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesUploaded: (files: File[]) => Promise<void>;
  onUrlSubmitted?: (url: string) => Promise<void>;
  onTextSubmitted?: (text: string, title: string) => Promise<void>;
  loading?: boolean;
}

export function AddSourceModal({
  isOpen,
  onClose,
  onFilesUploaded,
  onUrlSubmitted,
  onTextSubmitted,
  loading = false
}: AddSourceModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'text'>('upload');
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processingFiles, setProcessingFiles] = useState<string[]>([]);
  const [completedFiles, setCompletedFiles] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
      'audio/ogg': ['.ogg'],
      'audio/mp4': ['.m4a'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (uploadedFiles.length === 0) return;
    
    try {
      setProcessingFiles(uploadedFiles.map(f => f.name));
      await onFilesUploaded(uploadedFiles);
      setCompletedFiles(uploadedFiles.map(f => f.name));
      
      setTimeout(() => {
        setUploadedFiles([]);
        setProcessingFiles([]);
        setCompletedFiles([]);
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Upload error:', error);
      setProcessingFiles([]);
    }
  };

  const handleUrlSubmit = async () => {
    if (!url.trim() || !onUrlSubmitted) return;
    
    try {
      await onUrlSubmitted(url);
      setUrl('');
      onClose();
    } catch (error) {
      console.error('URL submit error:', error);
    }
  };

  const handleTextSubmit = async () => {
    if (!pastedText.trim()) return;
    
    if (onTextSubmitted) {
      try {
        await onTextSubmitted(pastedText, textTitle || 'Pasted Text');
        setPastedText('');
        setTextTitle('');
        onClose();
      } catch (error) {
        console.error('Text submit error:', error);
      }
    } else {
      // Fallback: create a text file
      const blob = new Blob([pastedText], { type: 'text/plain' });
      const file = new File([blob], `${textTitle || 'pasted-text'}.txt`, { type: 'text/plain' });
      await onFilesUploaded([file]);
    }
  };

  const resetAndClose = () => {
    setUploadedFiles([]);
    setProcessingFiles([]);
    setCompletedFiles([]);
    setUrl('');
    setPastedText('');
    setTextTitle('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="sm:max-w-lg z-50 bg-background overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Add Sources</DialogTitle>
        </DialogHeader>

        {/* Tab buttons */}
        <div className="flex gap-2 border-b border-border pb-3">
          <Button
            variant={activeTab === 'upload' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('upload')}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Files
          </Button>
          <Button
            variant={activeTab === 'url' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('url')}
            className="flex items-center gap-2"
          >
            <Link className="w-4 h-4" />
            Website / URL
          </Button>
          <Button
            variant={activeTab === 'text' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('text')}
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Paste Text
          </Button>
        </div>

        {/* Upload tab */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              {isDragActive ? (
                <p className="text-sm text-foreground font-medium">Drop files here...</p>
              ) : (
                <>
                  <p className="text-sm text-foreground font-medium">Drag & drop files here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                  <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> PDF, DOCX</span>
                    <span className="flex items-center gap-1"><Image className="w-3 h-3" /> Images</span>
                    <span className="flex items-center gap-1"><Mic className="w-3 h-3" /> Audio</span>
                  </div>
                </>
              )}
            </div>

            {/* File list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    {processingFiles.includes(file.name) ? (
                      completedFiles.includes(file.name) ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      )
                    ) : (
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={uploadedFiles.length === 0 || processingFiles.length > 0}
              className="w-full"
            >
              {processingFiles.length > 0 ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing {processingFiles.length} file(s)...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {uploadedFiles.length > 0 ? `${uploadedFiles.length} file(s)` : 'Files'}
                </>
              )}
            </Button>
          </div>
        )}

        {/* URL tab */}
        {activeTab === 'url' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Website or YouTube URL</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com or https://youtube.com/watch?v=..."
              />
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Link className="w-3 h-3" /> Web pages</span>
                <span className="flex items-center gap-1"><Youtube className="w-3 h-3" /> YouTube videos</span>
              </div>
            </div>
            <Button
              onClick={handleUrlSubmit}
              disabled={!url.trim() || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding URL...
                </>
              ) : (
                'Add URL as Source'
              )}
            </Button>
          </div>
        )}

        {/* Paste text tab */}
        {activeTab === 'text' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title (optional)</label>
              <Input
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="My Notes"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Paste your text</label>
              <Textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste any text content here..."
                rows={8}
                className="resize-none"
              />
            </div>
            <Button
              onClick={handleTextSubmit}
              disabled={!pastedText.trim() || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding text...
                </>
              ) : (
                'Add Text as Source'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
