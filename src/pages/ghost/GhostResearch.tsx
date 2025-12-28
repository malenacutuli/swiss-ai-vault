import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { SimpleSidebar } from '@/components/layout/SimpleSidebar';
import { 
  BookOpen, Search, ArrowRight, Loader2, 
  GraduationCap, FlaskConical, Lightbulb, ExternalLink, Globe, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Citation {
  index: number;
  url: string;
  domain: string;
}

interface SearchResult {
  content: string;
  citations: Citation[];
}

const filters = ['Peer-reviewed', 'Preprints', 'Clinical Trials'];

export default function GhostResearch() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchMode, setSearchMode] = useState<'search' | 'pro'>('search');
  const [selectedFilter, setSelectedFilter] = useState('Peer-reviewed');

  // Dynamic suggestions based on input prefix
  const getSuggestions = (input: string): string[] => {
    const lower = input.toLowerCase();
    
    if (lower.startsWith('find') || lower.startsWith('show')) {
      return [
        'Find recent clinical trials on GLP-1 receptor agonists for weight loss',
        'Show peer-reviewed papers on CRISPR gene editing applications',
        'Find longitudinal studies on intermittent fasting and longevity',
      ];
    }
    if (lower.startsWith('what') || lower.startsWith('how')) {
      return [
        'What are the latest breakthroughs in solid-state battery research?',
        'How effective are mRNA vaccines compared to traditional vaccines?',
        'What does current research say about neuroplasticity in adults?',
      ];
    }
    if (lower.startsWith('compare') || lower.startsWith('review')) {
      return [
        'Compare outcomes of robotic vs traditional surgery for prostate cancer',
        'Review of machine learning applications in drug discovery',
        'Compare efficacy of different Alzheimer\'s treatments in clinical trials',
      ];
    }
    // Default suggestions
    return [
      'Latest research on longevity and aging interventions',
      'AI applications in medical diagnostics',
      'Climate change mitigation technologies research',
    ];
  };

  const categories = [
    { name: 'Life Sciences & Medicine', color: 'from-emerald-900 to-emerald-700' },
    { name: 'Technology & Computing', color: 'from-blue-900 to-blue-700' },
    { name: 'Economics & Finance', color: 'from-amber-900 to-amber-700' },
    { name: 'Environmental Science', color: 'from-teal-900 to-teal-700' },
  ];

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('ghost-discover', {
        body: { module: 'research', query: `${query} (Filter: ${selectedFilter})` },
      });
      
      if (error) throw error;
      setResult(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const suggestions = getSuggestions(query);

  return (
    <div className="flex min-h-screen bg-[#FEFEFB]">
      <SimpleSidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      <div className="flex-1 flex flex-col items-center justify-start pt-24 px-6">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground">Academic Research</h1>
        </div>

        {/* Search Card */}
        <Card className="w-full max-w-2xl p-6 bg-white border-border/40 shadow-sm">
          {/* Dynamic Title */}
          <div className="mb-4">
            <p className="text-lg text-foreground/80 min-h-[28px]">
              {query || 'Ask any question about research & studies'}
            </p>
          </div>
          
          {/* Search Mode & Filter */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm">
              <button 
                onClick={() => setSearchMode('search')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors",
                  searchMode === 'search' 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Search className="w-3.5 h-3.5" />
                Search
              </button>
              <button 
                onClick={() => setSearchMode('pro')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors",
                  searchMode === 'pro' 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Pro Search
              </button>
              <span className="text-border">|</span>
              <button className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Globe className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Selector */}
            <div className="flex items-center gap-1.5">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFilter(f)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-full transition-colors",
                    selectedFilter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          
          {/* Search Input */}
          <div className="relative mb-6">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ask any question about research & studies"
              className="h-12 text-base rounded-xl border-0 bg-transparent focus-visible:ring-0 px-0 text-foreground placeholder:text-muted-foreground"
            />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground">
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={handleSearch}
                disabled={isSearching || !query.trim()}
                className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isSearching ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Dynamic Suggestions */}
          <div className="space-y-1">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => setQuery(suggestion)}
                className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 text-left text-sm transition-colors text-foreground/80"
              >
                <ArrowRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                {suggestion}
              </button>
            ))}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 mt-6 mb-8">
          <Button variant="outline" className="gap-2 rounded-full">
            <GraduationCap className="w-4 h-4" />
            Academic Papers
          </Button>
          <Button variant="outline" className="gap-2 rounded-full">
            <FlaskConical className="w-4 h-4" />
            Clinical Trials
          </Button>
          <Button variant="outline" className="gap-2 rounded-full">
            <Lightbulb className="w-4 h-4" />
            Patents
          </Button>
        </div>

        {/* Search Result */}
        {result && (
          <Card className="w-full max-w-2xl p-6 bg-white border-border/40 mb-8">
            <div className="prose prose-sm max-w-none text-foreground">
              {result.content.split('\n').map((paragraph, i) => (
                paragraph.trim() && (
                  <p key={i} className="mb-3 text-foreground/90 leading-relaxed">
                    {paragraph}
                  </p>
                )
              ))}
            </div>
            
            {result.citations && result.citations.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border/30">
                <div className="flex flex-wrap gap-2">
                  {result.citations.map((citation) => (
                    <a
                      key={citation.index}
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted/50 hover:bg-muted rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="text-primary font-medium">[{citation.index}]</span>
                      <span className="truncate max-w-[120px]">
                        {citation.domain}
                      </span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Categories */}
        {!result && (
          <div className="w-full max-w-2xl">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Explore by Category</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map((category) => (
                <button
                  key={category.name}
                  onClick={() => setQuery(`Latest ${selectedFilter.toLowerCase()} research in ${category.name}`)}
                  className={cn(
                    "aspect-[4/3] rounded-2xl bg-gradient-to-br p-4 text-left transition-transform hover:scale-[1.02]",
                    category.color
                  )}
                >
                  <div className="h-full flex flex-col justify-end">
                    <p className="text-white text-sm font-medium leading-tight">{category.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
