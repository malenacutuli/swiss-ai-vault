import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Lock, AlertCircle, User, Bot, FileText, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Citation {
  id: string;
  filename: string;
  content: string;
  similarity: number;
}

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isDecrypting?: boolean;
  decryptionError?: boolean;
  timestamp: string;
  model?: string;
  citations?: Citation[];
}

function CitationBadge({ 
  number, 
  citation, 
  onClick 
}: { 
  number: number; 
  citation: Citation; 
  onClick: () => void;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-colors ml-0.5 -mt-1 align-super cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            aria-label={`Citation ${number} from ${citation.filename}`}
          >
            {number}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium text-xs">{citation.filename}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {citation.content.slice(0, 100)}...
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CitationFootnotes({ citations }: { citations: Citation[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/50 animate-fade-in">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        <FileText className="h-3 w-3" />
        <span className="font-medium">Sources ({citations.length})</span>
      </div>
      <div className="space-y-1.5" role="list" aria-label="Citation sources">
        {citations.map((citation, index) => {
          const isExpanded = expandedIds.has(citation.id);
          const similarityPercent = Math.round(citation.similarity * 100);
          
          return (
            <Collapsible
              key={citation.id}
              open={isExpanded}
              onOpenChange={() => toggleExpanded(citation.id)}
            >
              <div 
                className="rounded-lg bg-muted/50 overflow-hidden transition-all"
                role="listitem"
              >
                <CollapsibleTrigger className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] font-medium flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="truncate font-medium">{citation.filename}</span>
                    <span className="flex-shrink-0 text-muted-foreground">
                      {similarityPercent}% match
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-2.5 pb-2.5 pt-1">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {citation.content}
                    </p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

export function MessageBubble({
  role,
  content,
  isDecrypting,
  decryptionError,
  timestamp,
  model,
  citations
}: MessageBubbleProps) {
  const isUser = role === 'user';
  const [focusedCitation, setFocusedCitation] = useState<number | null>(null);

  const scrollToCitation = (index: number) => {
    setFocusedCitation(index);
    // Auto-collapse after 3 seconds
    setTimeout(() => setFocusedCitation(null), 3000);
  };

  const renderContentWithCitations = (text: string) => {
    if (!citations || citations.length === 0) {
      return text;
    }

    // Split content by citation markers [1], [2], etc.
    const citationRegex = /\[(\d+)\]/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(text)) !== null) {
      // Add text before the citation
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const citationNumber = parseInt(match[1], 10);
      const citation = citations[citationNumber - 1];

      if (citation) {
        parts.push(
          <CitationBadge
            key={`citation-${match.index}`}
            number={citationNumber}
            citation={citation}
            onClick={() => scrollToCitation(citationNumber - 1)}
          />
        );
      } else {
        // Keep original text if citation not found
        parts.push(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  const renderContent = () => {
    if (decryptionError) {
      return (
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Unable to decrypt message</span>
        </div>
      );
    }

    if (isDecrypting) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Decrypting...</span>
        </div>
      );
    }

    // Simple markdown-like code block detection
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.slice(lastIndex, match.index)
        });
      }

      parts.push({
        type: 'code',
        language: match[1] || 'text',
        content: match[2].trim()
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex)
      });
    }

    if (parts.length === 0) {
      return <p className="whitespace-pre-wrap break-words">{renderContentWithCitations(content)}</p>;
    }

    return (
      <>
        {parts.map((part, idx) => {
          if (part.type === 'code') {
            return (
              <div key={idx} className="my-2">
                <div className="text-xs text-muted-foreground mb-1">{part.language}</div>
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto text-sm">
                  <code>{part.content}</code>
                </pre>
              </div>
            );
          }
          return <p key={idx} className="whitespace-pre-wrap break-words">{renderContentWithCitations(part.content)}</p>;
        })}
      </>
    );
  };

  const hasCitations = citations && citations.length > 0 && !isUser;

  return (
    <div
      className={cn(
        "flex gap-3 mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div className="text-sm">
          {renderContent()}
        </div>
        
        {hasCitations && (
          <CitationFootnotes citations={citations} />
        )}
        
        <div className={cn(
          "text-xs mt-2 flex items-center gap-2",
          isUser ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          <span>{new Date(timestamp).toLocaleTimeString()}</span>
          {model && !isUser && (
            <>
              <span>•</span>
              <span>{model}</span>
            </>
          )}
          {!decryptionError && !isDecrypting && (
            <>
              <span>•</span>
              <Lock className="h-3 w-3" />
            </>
          )}
          {hasCitations && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {citations.length} source{citations.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
