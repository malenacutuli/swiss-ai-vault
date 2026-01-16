import React, { useState } from 'react';
import { 
  Search, Globe, FileText, ChevronRight, Loader2, 
  ExternalLink, BookOpen, Sparkles, RefreshCw 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeepResearch } from '@/hooks/useDeepResearch';

interface DeepResearchPanelProps {
  notebookId?: string;
  onSourceClick?: (source: any) => void;
  className?: string;
}

export function DeepResearchPanel({ notebookId, onSourceClick, className }: DeepResearchPanelProps) {
  const { progress, results, conductResearch, reset } = useDeepResearch();
  const [query, setQuery] = useState('');
  const [includeWeb, setIncludeWeb] = useState(true);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    await conductResearch(query, notebookId, { includeWeb });
  };
  
  const handleFollowUp = (question: string) => {
    setQuery(question);
    conductResearch(question, notebookId, { includeWeb });
  };
  
  const isSearching = ['searching', 'analyzing', 'synthesizing'].includes(progress.status);
  
  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Search className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Deep Research</h3>
            <p className="text-xs text-muted-foreground">AI-powered research across your sources and the web</p>
          </div>
        </div>
      </div>
      
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="p-4 border-b border-border">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What would you like to research?"
            disabled={isSearching}
            className="w-full pl-4 pr-12 py-3 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-muted"
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </button>
        </div>
        
        {/* Options */}
        <div className="flex items-center gap-4 mt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeWeb}
              onChange={(e) => setIncludeWeb(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Include web search</span>
          </label>
          
          {notebookId && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              Searching your documents
            </span>
          )}
        </div>
      </form>
      
      {/* Progress */}
      {isSearching && (
        <div className="px-4 py-6 border-b border-border bg-muted/10">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{progress.currentStep}</p>
              <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                  style={{ 
                    width: progress.status === 'searching' ? '33%' : 
                           progress.status === 'analyzing' ? '66%' : '90%' 
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Results */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {results && (
          <div className="space-y-6">
            {/* Answer */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Research Summary
                </span>
              </div>
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap prose prose-sm max-w-none">
                {results.answer}
              </div>
            </div>
            
            {/* Sources */}
            {results.sources.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Sources ({results.sources.length})
                  </span>
                </div>
                
                <div className="space-y-2">
                  {results.sources.map((source, i) => (
                    <button
                      key={i}
                      onClick={() => onSourceClick?.(source)}
                      className="w-full text-left p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {source.type === 'web' ? (
                              <Globe className="w-3.5 h-3.5 text-blue-500" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-primary" />
                            )}
                            <span className="text-sm font-medium text-foreground truncate">
                              {source.title}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {source.snippet}
                          </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Follow-up Questions */}
            {results.followUpQuestions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Dig Deeper
                  </span>
                </div>
                
                <div className="space-y-2">
                  {results.followUpQuestions.map((question, i) => (
                    <button
                      key={i}
                      onClick={() => handleFollowUp(question)}
                      className="w-full text-left px-4 py-3 rounded-xl border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all text-sm text-foreground"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* New Search */}
            <div className="pt-2">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="w-3 h-3" />
                Start new research
              </button>
            </div>
          </div>
        )}
        
        {/* Empty State */}
        {!results && progress.status === 'idle' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Search className="w-8 h-8 text-primary" />
            </div>
            <p className="text-muted-foreground text-sm">
              Ask a research question to explore<br />your documents and the web
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
