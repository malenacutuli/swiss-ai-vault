import { Shield, Lock, Search, Brain, Globe, Clock, BookOpen, ChevronDown, ExternalLink } from '@/icons';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

export interface ResearchCitation {
  url: string;
  title: string;
  snippet?: string;
}

interface ResearchResultProps {
  content: string;
  citations: ResearchCitation[];
  isEncrypted: boolean;
  model: string;
  processingTime: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    searchQueries: number;
  };
}

export function ResearchResult({ 
  content, 
  citations, 
  isEncrypted, 
  model,
  processingTime,
  usage 
}: ResearchResultProps) {
  return (
    <div className="space-y-4">
      {/* Header with encryption status */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border",
        isEncrypted
          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
          : "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
      )}>
        {isEncrypted ? (
          <>
            <div className="flex items-center gap-0.5">
              <Shield className="h-4 w-4 text-green-600" />
              <Lock className="h-3 w-3 text-green-600" />
            </div>
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Encrypted Research Report
            </span>
            <Badge variant="outline" className="ml-auto text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
              E2E Encrypted
            </Badge>
          </>
        ) : (
          <>
            <Search className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Deep Research Report
            </span>
          </>
        )}
      </div>
      
      {/* Content with markdown rendering */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          components={{
            // Custom renderer for citation links [1], [2], etc.
            a: ({ node, children, ...props }) => {
              const text = children?.toString() || '';
              const match = text.match(/^\[(\d+)\]$/);
              if (match) {
                const index = parseInt(match[1]) - 1;
                const citation = citations[index];
                if (citation) {
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "inline-flex items-center justify-center w-5 h-5 text-xs rounded-full no-underline hover:opacity-80",
                            isEncrypted
                              ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                              : "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
                          )}
                        >
                          {match[1]}
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <p className="font-medium">{citation.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{citation.url}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }
              }
              return <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>;
            }
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      
      {/* Metadata */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-3">
        <div className="flex items-center gap-1">
          <Brain className="h-3 w-3" />
          <span>{model}</span>
        </div>
        <div className="flex items-center gap-1">
          <Globe className="h-3 w-3" />
          <span>{usage.searchQueries} searches</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{(processingTime / 1000).toFixed(1)}s</span>
        </div>
      </div>
      
      {/* Sources list */}
      {citations.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className={cn(
            "flex items-center gap-2 text-sm hover:opacity-80",
            isEncrypted ? "text-green-600" : "text-purple-600"
          )}>
            <BookOpen className="h-4 w-4" />
            <span>{citations.length} sources</span>
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2 pl-6">
              {citations.map((citation, i) => (
                <a
                  key={i}
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 text-sm hover:bg-muted p-2 rounded group"
                >
                  <span className={cn(
                    "font-medium",
                    isEncrypted ? "text-green-600" : "text-purple-600"
                  )}>
                    [{i + 1}]
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{citation.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{citation.url}</p>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                </a>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
