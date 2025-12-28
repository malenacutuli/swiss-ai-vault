import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DiscoverLayout } from '@/components/ghost/DiscoverLayout';
import { CategoryCard, RESEARCH_CATEGORIES } from '@/components/ghost/CategoryCard';
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

const filters = ['Peer-reviewed', 'Preprints', 'Clinical'];

export default function GhostResearch() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
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
    <DiscoverLayout activeModule="research">
      <div className="flex-1 flex flex-col items-center justify-start pt-24 px-6">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-slate-500" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Academic Research</h1>
        </div>

        {/* Search Card */}
        <Card className="w-full max-w-2xl p-6 bg-white border-slate-200/60 shadow-sm">
          {/* Dynamic Title */}
          <div className="mb-4">
            <p className="text-lg text-slate-600 min-h-[28px]">
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
                    ? "bg-[#2A8C86]/10 text-[#2A8C86]" 
                    : "text-slate-500 hover:text-slate-700"
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
                    ? "bg-[#2A8C86]/10 text-[#2A8C86]" 
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Pro Search
              </button>
              <span className="text-slate-200">|</span>
              <button className="p-1.5 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600">
                <Globe className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Selector */}
            <div className="flex items-center gap-1">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFilter(f)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-full transition-colors",
                    selectedFilter === f
                      ? "bg-[#2A8C86] text-white"
                      : "bg-slate-100 text-slate-500 hover:text-slate-700"
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
              className="h-12 text-base rounded-xl border-0 bg-transparent focus-visible:ring-0 px-0 text-slate-900 placeholder:text-slate-400"
            />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400">
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={handleSearch}
                disabled={isSearching || !query.trim()}
                className="p-2 rounded-full bg-[#2A8C86] text-white hover:bg-[#2A8C86]/90 disabled:opacity-50 transition-colors"
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
                className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 text-left text-sm transition-colors text-slate-600"
              >
                <ArrowRight className="w-4 h-4 text-[#2A8C86] flex-shrink-0 mt-0.5" />
                {suggestion}
              </button>
            ))}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 mt-6 mb-8">
          <Button variant="outline" className="gap-2 rounded-full border-slate-200 text-slate-600 hover:text-slate-900">
            <GraduationCap className="w-4 h-4" />
            Academic Papers
          </Button>
          <Button variant="outline" className="gap-2 rounded-full border-slate-200 text-slate-600 hover:text-slate-900">
            <FlaskConical className="w-4 h-4" />
            Clinical Trials
          </Button>
          <Button variant="outline" className="gap-2 rounded-full border-slate-200 text-slate-600 hover:text-slate-900">
            <Lightbulb className="w-4 h-4" />
            Patents
          </Button>
        </div>

        {/* Search Result */}
        {result && (
          <Card className="w-full max-w-2xl p-6 bg-white border-slate-200/60 mb-8">
            <div className="prose prose-sm max-w-none text-slate-700">
              {result.content.split('\n').map((paragraph, i) => (
                paragraph.trim() && (
                  <p key={i} className="mb-3 leading-relaxed">
                    {paragraph}
                  </p>
                )
              ))}
            </div>
            
            {result.citations && result.citations.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex flex-wrap gap-2">
                  {result.citations.map((citation) => (
                    <a
                      key={citation.index}
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 rounded-full text-xs text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <span className="text-[#2A8C86] font-medium">[{citation.index}]</span>
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
            <h3 className="text-sm font-medium text-slate-500 mb-4">Explore by Category</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {RESEARCH_CATEGORIES.map((category) => (
                <CategoryCard
                  key={category.name}
                  name={category.name}
                  gradientFrom={category.gradientFrom}
                  gradientTo={category.gradientTo}
                  onClick={() => setQuery(`Latest ${selectedFilter.toLowerCase()} research in ${category.name}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DiscoverLayout>
  );
}
