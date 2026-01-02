import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, FileText, Globe, MessageSquare, StickyNote } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface MemorySource {
  id: string;
  title: string;
  content: string;
  score: number;
  type: 'document' | 'note' | 'chat' | 'url';
  createdAt?: number;
}

interface MemorySourcesCardProps {
  sources: MemorySource[];
  className?: string;
}

export const MemorySourcesCard: React.FC<MemorySourcesCardProps> = ({
  sources,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText className="h-3 w-3" />;
      case 'url': return <Globe className="h-3 w-3" />;
      case 'chat': return <MessageSquare className="h-3 w-3" />;
      case 'note': return <StickyNote className="h-3 w-3" />;
      default: return <Brain className="h-3 w-3" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return 'bg-green-500';
    if (score >= 0.5) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <Card className={cn("bg-muted/30 border-border/50", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Brain className="h-4 w-4 text-primary" />
              <span className="font-medium">Personal Memory</span>
              <Badge variant="secondary" className="text-xs">
                {sources.length} source{sources.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            {sources.map((source, index) => (
              <div 
                key={source.id || index}
                className="p-2.5 rounded-md bg-background/50 border border-border/30"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {getTypeIcon(source.type)}
                    <span className="font-medium text-foreground truncate max-w-[200px]">
                      {source.title || `Memory ${index + 1}`}
                    </span>
                    {source.createdAt && (
                      <span className="text-muted-foreground/60">
                        · {formatDate(source.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div 
                      className={cn("w-1.5 h-1.5 rounded-full", getScoreColor(source.score))}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(source.score * 100)}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {source.content.substring(0, 200)}
                  {source.content.length > 200 && '...'}
                </p>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
