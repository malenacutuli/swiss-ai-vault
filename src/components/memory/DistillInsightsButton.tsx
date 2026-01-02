import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Sparkles, 
  Brain, 
  CheckCircle2, 
  ListChecks, 
  MessageSquare, 
  Tag,
  HelpCircle,
  Lightbulb,
  AlertCircle
} from 'lucide-react';
import { 
  distillBatch, 
  saveInsight, 
  getDistilledSourceIds,
  getInsights,
  type DistilledInsight 
} from '@/lib/memory/distill';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import { searchMemories } from '@/lib/memory/memory-store';
import { useToast } from '@/hooks/use-toast';

interface Props {
  onComplete?: (insights: DistilledInsight[]) => void;
}

export function DistillInsightsButton({ onComplete }: Props) {
  const { getMasterKey, isUnlocked } = useEncryptionContext();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<'idle' | 'scanning' | 'processing' | 'complete'>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0, title: '' });
  const [results, setResults] = useState<DistilledInsight[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undistilledCount, setUndistilledCount] = useState(0);
  
  const handleOpen = useCallback(async () => {
    setIsOpen(true);
    setStage('scanning');
    setError(null);
    setResults(null);
    
    try {
      const key = getMasterKey();
      if (!key) {
        setError('Please unlock your vault first');
        setStage('idle');
        return;
      }
      
      // Get all conversation memories
      const dummyEmbedding = new Array(384).fill(0);
      const allMemories = await searchMemories(dummyEmbedding, key, { 
        topK: 1000, 
        minScore: 0,
        source: 'chat'
      });
      
      // Get already distilled IDs
      const distilledIds = await getDistilledSourceIds();
      
      // Filter undistilled conversations
      const undistilled = allMemories.filter(m => !distilledIds.has(m.item.id));
      setUndistilledCount(undistilled.length);
      setStage('idle');
      
    } catch (err) {
      console.error('Failed to scan memories:', err);
      setError('Failed to scan memories');
      setStage('idle');
    }
  }, [getMasterKey]);
  
  const handleDistill = useCallback(async () => {
    setStage('processing');
    setResults(null);
    setError(null);
    
    try {
      const key = getMasterKey();
      if (!key) {
        setError('Please unlock your vault first');
        setStage('idle');
        return;
      }
      
      // Get all conversation memories
      const dummyEmbedding = new Array(384).fill(0);
      const allMemories = await searchMemories(dummyEmbedding, key, { 
        topK: 1000, 
        minScore: 0,
        source: 'chat'
      });
      
      // Get already distilled IDs
      const distilledIds = await getDistilledSourceIds();
      
      // Filter undistilled conversations
      const undistilled = allMemories
        .filter(m => !distilledIds.has(m.item.id))
        .map(m => ({
          id: m.item.id,
          title: m.item.metadata.title || 'Untitled',
          content: m.item.content,
          source: m.item.metadata.source
        }));
      
      if (undistilled.length === 0) {
        setResults([]);
        setStage('complete');
        return;
      }
      
      // Distill conversations
      const insights = await distillBatch(
        undistilled,
        (current, total, title) => setProgress({ current, total, title })
      );
      
      // Save insights to IndexedDB
      for (const insight of insights) {
        await saveInsight(insight);
      }
      
      setResults(insights);
      setStage('complete');
      onComplete?.(insights);
      
      toast({
        title: 'Insights extracted',
        description: `Created ${insights.length} structured insights from your conversations`
      });
      
    } catch (err) {
      console.error('Distill failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to distill conversations');
      setStage('idle');
    }
  }, [getMasterKey, onComplete, toast]);
  
  const handleClose = () => {
    setIsOpen(false);
    setStage('idle');
    setProgress({ current: 0, total: 0, title: '' });
    setResults(null);
    setError(null);
  };
  
  const progressPercent = progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;
  
  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleOpen}
        disabled={!isUnlocked}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Distill Insights
      </Button>
      
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Distill Insights
            </DialogTitle>
            <DialogDescription>
              AI extracts key points, topics, and action items from your conversations.
            </DialogDescription>
          </DialogHeader>
          
          {/* Idle / Ready State */}
          {stage === 'idle' && !error && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
              </div>
              
              <p className="text-center text-sm text-muted-foreground">
                Analyze your imported conversations to extract structured insights like 
                key points, topics, action items, and decisions.
              </p>
              
              {undistilledCount > 0 ? (
                <div className="text-center">
                  <Badge variant="secondary" className="mb-4">
                    {undistilledCount} conversation{undistilledCount !== 1 ? 's' : ''} to analyze
                  </Badge>
                </div>
              ) : undistilledCount === 0 && (
                <div className="text-center">
                  <Badge variant="outline" className="mb-4">
                    All conversations already analyzed
                  </Badge>
                </div>
              )}
              
              <Button 
                onClick={handleDistill} 
                className="w-full"
                disabled={undistilledCount === 0}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Start Distilling
              </Button>
            </div>
          )}
          
          {/* Scanning State */}
          {stage === 'scanning' && (
            <div className="space-y-4 py-8">
              <div className="flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Scanning your memories...
              </p>
            </div>
          )}
          
          {/* Processing State */}
          {stage === 'processing' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                </div>
              </div>
              
              <Progress value={progressPercent} className="h-2" />
              
              <div className="text-center space-y-1">
                <p className="text-sm font-medium truncate">
                  Analyzing: {progress.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {progress.current} of {progress.total} conversations
                </p>
              </div>
            </div>
          )}
          
          {/* Error State */}
          {error && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <p className="text-center text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={handleClose} className="w-full">
                Close
              </Button>
            </div>
          )}
          
          {/* Complete State */}
          {stage === 'complete' && results && (
            <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
              {/* Success Header */}
              <div className="flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-2xl font-bold">{results.length}</p>
                <p className="text-sm text-muted-foreground">insights created</p>
              </div>
              
              {/* Results Preview */}
              {results.length > 0 && (
                <ScrollArea className="flex-1 max-h-[300px]">
                  <Accordion type="single" collapsible className="w-full">
                    {results.slice(0, 5).map((insight) => (
                      <AccordionItem key={insight.id} value={insight.id}>
                        <AccordionTrigger className="text-sm text-left">
                          <span className="truncate pr-2">{insight.title}</span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 text-sm">
                            {/* Summary */}
                            <p className="text-muted-foreground">{insight.summary}</p>
                            
                            {/* Key Points */}
                            {insight.keyPoints.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1 text-xs font-medium mb-1">
                                  <Lightbulb className="h-3 w-3" />
                                  Key Points
                                </div>
                                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                                  {insight.keyPoints.slice(0, 3).map((point, i) => (
                                    <li key={i}>{point}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Topics */}
                            {insight.topics.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {insight.topics.map((topic, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            
                            {/* Action Items */}
                            {insight.actionItems.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1 text-xs font-medium mb-1">
                                  <ListChecks className="h-3 w-3" />
                                  Action Items
                                </div>
                                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                                  {insight.actionItems.map((item, i) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                  
                  {results.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      +{results.length - 5} more insights
                    </p>
                  )}
                </ScrollArea>
              )}
              
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
