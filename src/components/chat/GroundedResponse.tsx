import { useState } from 'react';
import { Shield, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { GroundedChatMessage, SourceDocument } from '@/types/grounded';

interface GroundedResponseProps {
  message: GroundedChatMessage;
  onSourceClick?: (source: SourceDocument) => void;
}

export function GroundedResponse({ message, onSourceClick }: GroundedResponseProps) {
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);

  // Parse content and replace [SOURCE_N] with clickable badges
  const renderContent = () => {
    if (!message.isGrounded || !message.citations?.length) {
      return <p className="text-foreground whitespace-pre-wrap">{message.content}</p>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = /\[SOURCE_(\d+)\]/g;
    let match;

    while ((match = regex.exec(message.content)) !== null) {
      // Add text before the citation
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {message.content.slice(lastIndex, match.index)}
          </span>
        );
      }

      // Add citation badge
      const sourceIndex = parseInt(match[1]) - 1;
      const source = message.sources?.[sourceIndex];
      
      parts.push(
        <Badge
          key={`cite-${match.index}`}
          variant="secondary"
          className="mx-0.5 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs px-1.5 py-0"
          onClick={() => source && onSourceClick?.(source)}
        >
          {match[1]}
        </Badge>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < message.content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {message.content.slice(lastIndex)}
        </span>
      );
    }

    return <p className="text-foreground whitespace-pre-wrap leading-relaxed">{parts}</p>;
  };

  const citedSources = message.sources?.filter(source => 
    message.citations?.some(c => c.sourceId === source.id)
  ) || [];

  return (
    <div className="space-y-3">
      {/* Grounded indicator */}
      {message.isGrounded && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span>
            Grounded response • {citedSources.length} source{citedSources.length !== 1 ? 's' : ''} cited
          </span>
        </div>
      )}

      {/* Main content */}
      <div className="prose prose-sm max-w-none dark:prose-invert">
        {renderContent()}
      </div>

      {/* Sources panel */}
      {citedSources.length > 0 && (
        <Collapsible open={isSourcesOpen} onOpenChange={setIsSourcesOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <FileText className="h-4 w-4" />
              {isSourcesOpen ? 'Hide' : 'Show'} Sources ({citedSources.length})
              {isSourcesOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-3 space-y-2">
            {citedSources.map((source, index) => (
              <Card
                key={source.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm",
                  "bg-muted/30"
                )}
                onClick={() => onSourceClick?.(source)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {index + 1}
                        </Badge>
                        <span className="font-medium text-sm text-foreground">
                          {source.title}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {source.content.substring(0, 150)}...
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
