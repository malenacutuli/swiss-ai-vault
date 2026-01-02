import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, CheckCircle, Brain, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { 
  parseChatGPTExport, 
  importChatGPTHistory, 
  type ImportProgress, 
  type ImportResult 
} from '@/lib/memory/importers/chatgpt-importer';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ImportChatGPTModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportChatGPTModal({ open, onOpenChange }: ImportChatGPTModalProps) {
  const navigate = useNavigate();
  const { getMasterKey, isUnlocked } = useEncryptionContext();
  
  const [stage, setStage] = useState<'upload' | 'importing' | 'complete'>('upload');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    // Check vault is unlocked
    const key = getMasterKey();
    if (!key) {
      setError('Please unlock your vault first to import conversations');
      return;
    }
    
    setError(null);
    setStage('importing');
    
    try {
      const conversations = await parseChatGPTExport(file);
      
      if (conversations.length === 0) {
        throw new Error('No valid conversations found in file');
      }
      
      const importResult = await importChatGPTHistory(
        conversations,
        key,
        setProgress
      );
      
      setResult(importResult);
      setStage('complete');
      
    } catch (err) {
      console.error('[ImportChatGPT] Error:', err);
      setError(err instanceof Error ? err.message : 'Import failed');
      setStage('upload');
    }
  }, [getMasterKey]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    maxFiles: 1,
    disabled: !isUnlocked
  });
  
  const handleClose = () => {
    setStage('upload');
    setProgress(null);
    setResult(null);
    setError(null);
    onOpenChange(false);
  };
  
  const handleExploreMemory = () => {
    handleClose();
    navigate('/ghost/memory');
  };
  
  const progressPercent = progress 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            {stage === 'complete' ? 'Import Complete!' : 'Import ChatGPT History'}
          </DialogTitle>
          <DialogDescription>
            {stage === 'upload' && 'Upload your conversations.json file from ChatGPT export'}
            {stage === 'importing' && 'Processing your conversations...'}
            {stage === 'complete' && 'Your memories are ready to use'}
          </DialogDescription>
        </DialogHeader>
        
        {/* Upload Stage */}
        {stage === 'upload' && (
          <div className="space-y-4">
            {!isUnlocked && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Please unlock your vault first to import conversations
                </p>
              </div>
            )}
            
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                isDragActive 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50 hover:bg-muted/30",
                !isUnlocked && "opacity-50 cursor-not-allowed"
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {isDragActive 
                  ? 'Drop your file here' 
                  : 'Drag & drop conversations.json, or click to browse'}
              </p>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              Export from ChatGPT: Settings → Data Controls → Export Data
            </p>
            
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Importing Stage */}
        {stage === 'importing' && progress && (
          <div className="space-y-4 py-4">
            <Progress value={progressPercent} className="h-2" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium truncate">
                Importing "{progress.currentTitle}"
              </p>
              <p className="text-xs text-muted-foreground">
                {progress.current} of {progress.total} conversations
              </p>
              {progress.phase === 'embedding' && (
                <p className="text-xs text-primary">
                  Generating embeddings...
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Complete Stage */}
        {stage === 'complete' && result && (
          <div className="space-y-4 py-2">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{result.imported}</p>
                <p className="text-xs text-muted-foreground">Conversations</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{result.totalMessages}</p>
                <p className="text-xs text-muted-foreground">Messages</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{result.topTopics.length}</p>
                <p className="text-xs text-muted-foreground">Topics</p>
              </div>
            </div>
            
            {/* Top Topics */}
            {result.topTopics.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Your Top Topics</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.topTopics.slice(0, 5).map((topic, i) => (
                    <span 
                      key={i}
                      className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                    >
                      {topic.topic} ({topic.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Date Range */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {result.dateRange.earliest.toLocaleDateString()} - {result.dateRange.latest.toLocaleDateString()}
              </span>
            </div>
            
            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {result.errors.length} conversation(s) couldn't be imported
                </p>
              </div>
            )}
            
            {/* Action Button */}
            <Button 
              onClick={handleExploreMemory}
              className="w-full"
            >
              <Brain className="h-4 w-4 mr-2" />
              Explore Your Memory
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
