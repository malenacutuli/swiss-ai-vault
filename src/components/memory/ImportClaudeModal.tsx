import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, CheckCircle, Brain, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { parseClaudeExport, importClaudeHistory, ImportProgress, ImportResult } from '@/lib/memory/importers/claude-importer';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { cn } from '@/lib/utils';

interface ImportClaudeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportClaudeModal({ open, onOpenChange }: ImportClaudeModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getMasterKey, isUnlocked } = useEncryptionContext();
  const [stage, setStage] = useState<'upload' | 'importing' | 'complete'>('upload');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    const encryptionKey = getMasterKey();
    if (!isUnlocked || !encryptionKey) {
      setError(t('memory.import.unlockFirst', 'Please unlock your vault first to import conversations'));
      return;
    }
    
    setError(null);
    setStage('importing');
    
    try {
      const conversations = await parseClaudeExport(file);
      
      if (conversations.length === 0) {
        throw new Error(t('memory.import.noConversations', 'No conversations found in file'));
      }
      
      const importResult = await importClaudeHistory(
        conversations,
        encryptionKey,
        setProgress
      );
      
      setResult(importResult);
      setStage('complete');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : t('memory.import.failed', 'Import failed'));
      setStage('upload');
    }
  }, [getMasterKey, isUnlocked]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    maxFiles: 1
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
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            {stage === 'complete' ? t('memory.import.complete', 'Import Complete!') : t('memory.import.claudeTitle', 'Import Claude History')}
          </DialogTitle>
          <DialogDescription>
            {stage === 'upload' && t('memory.import.claudeUploadDesc', 'Upload your conversations.json file from Claude export')}
            {stage === 'importing' && t('memory.import.processing', 'Processing your conversations...')}
            {stage === 'complete' && t('memory.import.ready', 'Your memories are ready to use')}
          </DialogDescription>
        </DialogHeader>
        
        {stage === 'upload' && (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isDragActive ? t('memory.import.dropHere', 'Drop your file here') : t('memory.import.claudeDragDrop', 'Drag & drop conversations.json, or click to browse')}
              </p>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              {t('memory.import.claudeExportHint', 'Export from Claude: Settings → Account → Export Data')}
            </p>
            
            {!isUnlocked && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <p className="text-xs text-amber-500">{t('memory.import.unlockFirst', 'Please unlock your vault first')}</p>
              </div>
            )}
            
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
          </div>
        )}
        
        {stage === 'importing' && progress && (
          <div className="space-y-4 py-4">
            <Progress value={(progress.current / progress.total) * 100} />
            <div className="text-center">
              <p className="text-sm font-medium truncate">{t('memory.import.importing', 'Importing')} "{progress.currentTitle}"</p>
              <p className="text-xs text-muted-foreground mt-1">
                {progress.current} {t('memory.distill.of', 'of')} {progress.total} {t('memory.distill.conversations', 'conversations')}
              </p>
            </div>
          </div>
        )}
        
        {stage === 'complete' && result && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <p className="text-2xl font-bold">{result.imported}</p>
                <p className="text-xs text-muted-foreground">{t('memory.import.conversations', 'Conversations')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{result.totalMessages}</p>
                <p className="text-xs text-muted-foreground">{t('memory.import.messages', 'Messages')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{result.topTopics.length}</p>
                <p className="text-xs text-muted-foreground">{t('memory.import.topics', 'Topics')}</p>
              </div>
            </div>
            
            {result.topTopics.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t('memory.import.yourTopTopics', 'Your Top Topics')}</p>
                <div className="flex flex-wrap gap-1">
                  {result.topTopics.slice(0, 5).map((topic, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-xs"
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span className="truncate max-w-[100px]">
                        {topic.topic} ({topic.count})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                {result.dateRange.earliest.toLocaleDateString()} - {result.dateRange.latest.toLocaleDateString()}
              </span>
            </div>
            
            <div className="pt-2">
              <Button onClick={handleExploreMemory} className="w-full">
                <Brain className="h-4 w-4 mr-2" />
                {t('memory.import.viewMemory', 'View Memory')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
