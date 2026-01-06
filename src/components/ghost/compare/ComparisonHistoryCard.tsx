import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Coins, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { CompareResponse } from '@/hooks/useCompareMode';

export interface ComparisonHistoryData {
  prompt: string;
  responses: CompareResponse[];
  selectedModelId: string;
  timestamp: string;
}

interface ComparisonHistoryCardProps {
  data: ComparisonHistoryData;
  className?: string;
}

export function ComparisonHistoryCard({ data, className }: ComparisonHistoryCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const completedResponses = data.responses.filter(r => r.status === 'complete');
  const selectedResponse = data.responses.find(r => r.model === data.selectedModelId);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between h-auto py-2 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <span className="flex items-center gap-2">
            <span className="font-medium">Model Comparison</span>
            <Badge variant="outline" className="text-[10px] h-5">
              {completedResponses.length} models
            </Badge>
            {selectedResponse && (
              <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                <Check className="h-2.5 w-2.5" />
                {selectedResponse.displayName}
              </Badge>
            )}
          </span>
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2">
        <div className="space-y-2 pl-3 border-l-2 border-muted">
          {data.responses.map((response) => {
            const isSelected = response.model === data.selectedModelId;
            const isError = response.status === 'error';
            
            return (
              <div 
                key={response.model}
                className={cn(
                  "p-3 rounded-lg border text-sm",
                  isSelected 
                    ? "bg-primary/5 border-primary/30" 
                    : "bg-muted/30 border-border/50",
                  isError && "border-destructive/30 bg-destructive/5"
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">{response.displayName}</span>
                    <Badge variant="outline" className="text-[10px] h-4">
                      {response.provider}
                    </Badge>
                    {isSelected && (
                      <Badge variant="default" className="text-[10px] h-4 gap-0.5">
                        <Check className="h-2 w-2" />
                        Selected
                      </Badge>
                    )}
                  </div>
                  {response.status === 'complete' && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {(response.latency / 1000).toFixed(1)}s
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Coins className="h-2.5 w-2.5" />
                        {response.tokens}
                      </span>
                      {response.rating !== undefined && (
                        <span className="flex items-center gap-0.5">
                          {response.rating === 1 ? (
                            <ThumbsUp className="h-2.5 w-2.5 text-green-500" />
                          ) : (
                            <ThumbsDown className="h-2.5 w-2.5 text-red-500" />
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Content Preview */}
                {isError ? (
                  <p className="text-xs text-destructive">{response.error || 'Error generating response'}</p>
                ) : response.response ? (
                  <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {response.response}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No response</p>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
