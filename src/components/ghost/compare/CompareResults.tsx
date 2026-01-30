import { useState, useEffect } from 'react';
import { Copy, ThumbsUp, ThumbsDown, Check, Loader2, AlertCircle, Clock, Coins, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { CompareResult, CompareResponse } from '@/hooks/useCompareMode';

interface CompareResultsProps {
  result: CompareResult;
  onRate: (modelId: string, rating: number) => void;
  onUseResponse: (response: CompareResponse) => void;
}

function LiveTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);
  
  return (
    <span className="font-mono text-xs text-muted-foreground">
      {(elapsed / 1000).toFixed(1)}s
    </span>
  );
}

function ResponseCard({ 
  response, 
  onRate, 
  onUseResponse,
  startTime,
}: { 
  response: CompareResponse;
  onRate: (rating: number) => void;
  onUseResponse: () => void;
  startTime: number;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!response.response) return;
    await navigator.clipboard.writeText(response.response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  const isError = response.status === 'error';
  const isLoading = response.status === 'pending' || response.status === 'streaming';

  return (
    <div className="flex flex-col border rounded-lg bg-card overflow-hidden min-h-[300px] max-h-[70vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{response.displayName}</span>
          <Badge variant="outline" className="text-xs">
            {response.provider}
          </Badge>
        </div>
        {response.status === 'complete' && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {(response.latency / 1000).toFixed(1)}s
            </span>
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3" />
              {response.tokens}
            </span>
          </div>
        )}
        {isLoading && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 animate-pulse" />
            <LiveTimer startTime={startTime} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto min-h-[200px]">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">{response.error}</span>
          </div>
        )}
        {response.status === 'complete' && response.response && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {response.response}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {response.status === 'complete' && (
        <div className="flex items-center justify-between p-3 border-t bg-muted/20">
          <div className="flex items-center gap-1">
            <Button
              variant={response.rating === 1 ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => onRate(1)}
            >
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button
              variant={response.rating === -1 ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => onRate(-1)}
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="secondary" size="sm" onClick={onUseResponse}>
              Use this
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CompareResults({ result, onRate, onUseResponse }: CompareResultsProps) {
  const [activeTab, setActiveTab] = useState(result.responses[0]?.model);
  const startTime = new Date(result.timestamp).getTime();

  const gridCols = result.responses.length === 2 
    ? 'lg:grid-cols-2' 
    : result.responses.length === 3 
    ? 'lg:grid-cols-3' 
    : 'lg:grid-cols-4';

  // Check if any response is still loading
  const isAnyLoading = result.responses.some(r => r.status === 'pending' || r.status === 'streaming');
  const hasCompletedResponses = result.responses.some(r => r.status === 'complete');
  
  return (
    <div className="flex flex-col gap-4">
      {/* Warning banner for unsaved comparison results */}
      {hasCompletedResponses && (
        <Alert variant="default" className="bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-xs text-amber-600 dark:text-amber-400">
            Click "Use this" to save a response. Comparison results will be lost on page refresh.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Prompt shown above results */}
      <div className="p-3 rounded-lg bg-muted/50 border">
        <span className="text-xs font-medium text-muted-foreground">Your prompt:</span>
        <p className="text-sm mt-1">{result.displayPrompt || result.prompt}</p>
        {result.attachmentSummary && (
          <Badge variant="secondary" className="mt-2 text-xs">
            📎 {result.attachmentSummary}
          </Badge>
        )}
      </div>

      {/* Desktop View - Side by Side */}
      <div className={cn("hidden lg:grid gap-4", gridCols)}>
        {result.responses.map((response) => (
          <div key={response.model} className="min-h-0">
            <ResponseCard
              response={response}
              onRate={(rating) => onRate(response.model, rating)}
              onUseResponse={() => onUseResponse(response)}
              startTime={startTime}
            />
          </div>
        ))}
      </div>

      {/* Mobile View - Tabs */}
      <div className="lg:hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {result.responses.map((response) => (
              <TabsTrigger key={response.model} value={response.model} className="gap-1.5">
                {response.displayName}
                {response.status === 'complete' && (
                  <Check className="h-3 w-3 text-green-500" />
                )}
                {response.status === 'error' && (
                  <AlertCircle className="h-3 w-3 text-destructive" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {result.responses.map((response) => (
            <TabsContent key={response.model} value={response.model} className="mt-4">
              <ResponseCard
                response={response}
                onRate={(rating) => onRate(response.model, rating)}
                onUseResponse={() => onUseResponse(response)}
                startTime={startTime}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
