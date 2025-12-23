import { SwissCard } from '@/components/ui/swiss';
import { Globe, Shield, Search, ExternalLink, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface GhostSearchViewProps {
  results?: SearchResult[];
  isSearching?: boolean;
  answer?: string;
  relatedQuestions?: string[];
  onSearchAgain?: (query: string) => void;
}

export function GhostSearchView({ 
  results = [], 
  isSearching = false, 
  answer,
  relatedQuestions = [],
  onSearchAgain 
}: GhostSearchViewProps) {
  // Empty state
  if (results.length === 0 && !isSearching && !answer) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-swiss-sapphire/10 border border-swiss-sapphire/20 flex items-center justify-center mb-6">
          <Globe className="w-8 h-8 text-swiss-sapphire" />
        </div>
        <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-sans text-center mb-3">
          Private Web Search
        </h2>
        <p className="text-muted-foreground text-center max-w-md mb-8">
          Search the web with AI-powered understanding. Your queries are anonymized
          and never linked to your identity.
        </p>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4 text-success" />
          <span>End-to-end encrypted with zero data retention</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* AI Answer */}
      {answer && (
        <SwissCard className="mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-swiss-sapphire/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-swiss-sapphire" />
            </div>
            <div className="flex-1 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
          </div>
        </SwissCard>
      )}

      {/* Search Results / Sources */}
      {results.length > 0 && (
        <div className="space-y-3 mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Sources</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((result, idx) => (
              <SwissCard key={idx} interactive className="group">
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-xs font-medium">
                          {idx + 1}
                        </div>
                        <h4 className="font-medium text-sm group-hover:text-swiss-sapphire transition-colors truncate">
                          {result.title || new URL(result.url).hostname}
                        </h4>
                      </div>
                      {result.snippet && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{result.snippet}</p>
                      )}
                      <p className="text-xs text-swiss-sapphire/60 mt-1.5 truncate">
                        {new URL(result.url).hostname}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                  </div>
                </a>
              </SwissCard>
            ))}
          </div>
        </div>
      )}

      {/* Related Questions */}
      {relatedQuestions.length > 0 && onSearchAgain && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Related Questions</p>
          <div className="flex flex-wrap gap-2">
            {relatedQuestions.map((question, idx) => (
              <button
                key={idx}
                onClick={() => onSearchAgain(question)}
                className="px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted text-sm text-foreground/80 hover:text-foreground transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isSearching && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Globe className="w-5 h-5 animate-pulse" />
            <span>Searching the web...</span>
          </div>
        </div>
      )}
    </div>
  );
}
