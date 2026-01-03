import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Upload, CheckCircle, Brain, Calendar, AlertCircle, ExternalLink, FileText } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { 
  parseUniversalExport, 
  importStandardConversations, 
  getSourceDisplayName,
  type ImportSource 
} from '@/lib/memory/importers/universal-importer';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ImportChatGPTModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (result: ImportResult) => void;
}

const SUPPORTED_SOURCES = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Grok', 'Copilot'] as const;

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  totalMessages: number;
  topTopics: Array<{ topic: string; count: number }>;
  source?: ImportSource;
}

export function ImportChatGPTModal({ open, onOpenChange, onComplete }: ImportChatGPTModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getMasterKey, isUnlocked } = useEncryptionContext();
  
  const [stage, setStage] = useState<'upload' | 'importing' | 'complete' | 'error'>('upload');
  const [progress, setProgress] = useState<{ current: number; total: number; title: string } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectedSource, setDetectedSource] = useState<ImportSource | null>(null);
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    // Check vault is unlocked
    const key = getMasterKey();
    if (!key) {
      setError(t('memory.import.unlockFirst', 'Please unlock your vault first to import conversations'));
      return;
    }
    
    if (!file.name.endsWith('.json')) {
      setError(t('memory.import.jsonOnly', 'Please upload a JSON file'));
      return;
    }
    
    setError(null);
    setStage('importing');
    
    try {
      // Parse with auto-detection
      const { source, conversations } = await parseUniversalExport(file);
      setDetectedSource(source);
      
      if (conversations.length === 0) {
        throw new Error(t('memory.import.noConversations', 'No valid conversations found in file'));
      }
      
      // Import using universal importer
      const importResult = await importStandardConversations(
        conversations,
        key,
        (p) => setProgress(p)
      );
      
      const finalResult = { ...importResult, source };
      setResult(finalResult);
      setStage('complete');
      onComplete?.(finalResult);
      
    } catch (err) {
      console.error('[ImportHistory] Error:', err);
      setError(err instanceof Error ? err.message : t('memory.import.failed', 'Import failed'));
      setStage('error');
    }
  }, [getMasterKey, t]);
  
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
    setDetectedSource(null);
    onOpenChange(false);
  };
  
  const handleReset = () => {
    setStage('upload');
    setProgress(null);
    setResult(null);
    setError(null);
    setDetectedSource(null);
  };
  
  const handleExploreMemory = () => {
    handleClose();
    navigate('/ghost/memory');
  };
  
  const progressPercent = progress 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;
  
  const sourceLabel = detectedSource ? getSourceDisplayName(detectedSource) : '';
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            {stage === 'complete' ? t('memory.import.complete', 'Import Complete!') : t('memory.import.title', 'Import AI History')}
          </DialogTitle>
          <DialogDescription>
            {stage === 'upload' && t('memory.import.uploadDescription', 'Import conversations from any AI platform. We auto-detect the format.')}
            {stage === 'importing' && t('memory.import.processing', 'Processing {{source}} conversations...').replace('{{source}}', sourceLabel)}
            {stage === 'complete' && t('memory.import.ready', 'Your memories are ready to use')}
            {stage === 'error' && t('memory.import.error', 'Something went wrong')}
          </DialogDescription>
        </DialogHeader>
        
        {/* Upload Stage */}
        {stage === 'upload' && (
          <div className="space-y-4">
            {/* Supported Sources Badges */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {SUPPORTED_SOURCES.map(source => (
                <Badge key={source} variant="secondary" className="text-xs">
                  {source}
                </Badge>
              ))}
            </div>
            
            {!isUnlocked && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {t('memory.import.unlockFirst', 'Please unlock your vault first to import conversations')}
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
                  ? t('memory.import.dropHere', 'Drop your file here') 
                  : t('memory.import.dragDrop', 'Drag & drop your export file, or click to browse')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('memory.import.acceptsJson', 'Accepts .json files')}
              </p>
            </div>
            
            {/* Export Instructions Accordion */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="chatgpt">
                <AccordionTrigger className="text-sm py-2">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('memory.import.exportFrom', 'Export from')} ChatGPT
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground">
                  Settings → Data controls → Export data → Download ZIP → Extract <code className="bg-muted px-1 rounded">conversations.json</code>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="claude">
                <AccordionTrigger className="text-sm py-2">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('memory.import.exportFrom', 'Export from')} Claude
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground">
                  Settings → Account → Export Data → Download <code className="bg-muted px-1 rounded">conversations.json</code>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="gemini">
                <AccordionTrigger className="text-sm py-2">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('memory.import.exportFrom', 'Export from')} Gemini
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground">
                  <a 
                    href="https://takeout.google.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Google Takeout <ExternalLink className="h-3 w-3" />
                  </a>
                  {' '}→ Select "Gemini Apps" → Export → Download JSON
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="perplexity">
                <AccordionTrigger className="text-sm py-2">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('memory.import.exportFrom', 'Export from')} Perplexity
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground">
                  Settings → Your Data → Export Search History → Download JSON
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="grok">
                <AccordionTrigger className="text-sm py-2">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('memory.import.exportFrom', 'Export from')} Grok
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground">
                  X Settings → Your Account → Download an archive → Extract conversations JSON
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="copilot">
                <AccordionTrigger className="text-sm py-2">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('memory.import.exportFrom', 'Export from')} Copilot
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground">
                  Microsoft Privacy Dashboard → Download your data → Extract Copilot conversations
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Importing Stage */}
        {stage === 'importing' && (
          <div className="space-y-4 py-4">
            <Progress value={progressPercent} className="h-2" />
            <div className="text-center space-y-1">
              {progress && (
                <>
                  <p className="text-sm font-medium truncate">
                    {t('memory.import.importing', 'Importing')} "{progress.title}"
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {progress.current} {t('memory.distill.of', 'of')} {progress.total} {t('memory.distill.conversations', 'conversations')}
                  </p>
                </>
              )}
              <p className="text-xs text-primary">
                {t('memory.import.generatingEmbeddings', 'Generating embeddings for memory search...')}
              </p>
            </div>
          </div>
        )}
        
        {/* Error Stage */}
        {stage === 'error' && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
            
            <Button onClick={handleReset} variant="outline" className="w-full">
              {t('memory.import.tryAgain', 'Try Again')}
            </Button>
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
            
            {/* Source Badge */}
            {detectedSource && (
              <div className="flex justify-center">
                <Badge variant="secondary" className="text-xs">
                  {t('memory.import.importedFrom', 'Imported from')} {sourceLabel}
                </Badge>
              </div>
            )}
            
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{result.imported}</p>
                <p className="text-xs text-muted-foreground">{t('memory.import.conversations', 'Conversations')}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{result.totalMessages}</p>
                <p className="text-xs text-muted-foreground">{t('memory.import.messages', 'Messages')}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{result.topTopics.length}</p>
                <p className="text-xs text-muted-foreground">{t('memory.import.topics', 'Topics')}</p>
              </div>
            </div>
            
            {/* Top Topics */}
            {result.topTopics.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t('memory.import.yourTopTopics', 'Your Top Topics')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.topTopics.slice(0, 5).map((topic, i) => (
                    <Badge 
                      key={i}
                      variant="outline"
                      className="text-xs"
                    >
                      {topic.topic} ({topic.count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Errors */}
            {result.failed > 0 && (
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t('memory.import.someFailed', "{{count}} conversation(s) couldn't be imported").replace('{{count}}', String(result.failed))}
                </p>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                onClick={handleReset}
                variant="outline"
                className="flex-1"
              >
                {t('memory.import.importMore', 'Import More')}
              </Button>
              <Button 
                onClick={handleExploreMemory}
                className="flex-1"
              >
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

// Keep the old export name for backwards compatibility
export { ImportChatGPTModal as ImportAIHistoryModal };
