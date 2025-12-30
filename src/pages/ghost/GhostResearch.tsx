import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DiscoverLayout } from '@/components/ghost/DiscoverLayout';
import { CategoryCard, RESEARCH_CATEGORIES } from '@/components/ghost/CategoryCard';
import { SearchModeSelector, SourcesDropdown, type SearchMode } from '@/components/ghost/discover';
import { 
  BookOpen,
  GraduationCap,
  TestTube,
  Files,
  ArrowRight,
  Loader2,
  ExternalLink,
  Search
} from '@/icons';
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

type ActionType = 'academic' | 'clinical' | 'preprints';

const getFilters = (t: (key: string) => string) => [
  { key: 'peerReviewed', label: t('ghost.modules.research.filters.peerReviewed') },
  { key: 'preprints', label: t('ghost.modules.research.filters.preprints') },
  { key: 'all', label: t('ghost.modules.research.filters.all') },
];

const getSuggestions = (action: ActionType, t: (key: string) => string): string[] => {
  const suggestions: Record<ActionType, string[]> = {
    academic: [
      t('ghost.modules.research.suggestions.longevity'),
      t('ghost.modules.research.suggestions.aiMedical'),
      t('ghost.modules.research.suggestions.climate'),
    ],
    clinical: [
      t('ghost.modules.research.suggestions.glp1'),
      t('ghost.modules.research.suggestions.alzheimers'),
      t('ghost.modules.research.suggestions.mrna'),
    ],
    preprints: [
      t('ghost.modules.research.suggestions.llm'),
      t('ghost.modules.research.suggestions.crispr'),
      t('ghost.modules.research.suggestions.longCovid'),
    ],
  };
  return suggestions[action];
};

export default function GhostResearch() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>('search');
  const [selectedFilter, setSelectedFilter] = useState('peerReviewed');
  const [activeAction, setActiveAction] = useState<ActionType>('academic');
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  const filters = getFilters(t);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const suggestions = useMemo(
    () => getSuggestions(activeAction, t),
    [activeAction, t]
  );

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setResult(null);
    setShowSuggestions(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('ghost-discover', {
        body: { 
          module: 'research', 
          query: `${query} (Filter: ${selectedFilter})`,
          mode: searchMode,
          action: activeAction,
          language: i18n.language
        },
      });
      
      if (error) throw error;
      setResult(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleActionClick = (action: ActionType) => {
    setActiveAction(action);
    setShowSuggestions(true);
    setQuery('');
  };

  return (
    <DiscoverLayout activeModule="research">
      <div className="flex-1 flex flex-col items-center justify-start pt-24 px-6">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <BookOpen className="w-10 h-10 text-swiss-teal mb-4" strokeWidth={1.25} />
          <h1 className="text-2xl font-semibold text-slate-900">{t('ghost.modules.research.title')}</h1>
        </div>

        {/* Search Card */}
        <Card className="w-full max-w-2xl p-5 bg-white border-slate-200/60 shadow-sm" ref={containerRef}>
          {/* Mode Selector, Sources & Filter */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <SearchModeSelector mode={searchMode} onModeChange={setSearchMode} />
              <SourcesDropdown module="research" />
            </div>

            {/* Filter Selector */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setSelectedFilter(f.key)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    selectedFilter === f.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" strokeWidth={1.5} />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.length === 0) {
                  setShowSuggestions(true);
                }
              }}
              onFocus={() => !query && setShowSuggestions(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('ghost.modules.research.placeholder')}
              className="h-14 text-base pl-12 pr-14 rounded-xl border-slate-200/60 bg-white shadow-sm text-slate-900 placeholder:text-slate-400"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[#2A8C86] text-white hover:bg-[#2A8C86]/90 disabled:opacity-50 transition-colors"
            >
              {isSearching ? (
                <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} />
              ) : (
                <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
              )}
            </button>
            
            {/* Suggestions Dropdown */}
            {showSuggestions && !query && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
                <p className="text-xs font-medium text-slate-500 px-4 py-2 border-b border-slate-100">
                  {t(`ghost.modules.research.getStarted.${activeAction}`)}
                </p>
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(suggestion);
                      setShowSuggestions(false);
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left text-sm text-slate-700 transition-colors border-b border-slate-50 last:border-b-0"
                  >
                    <Search className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span className="line-clamp-2">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 mt-6 mb-8">
          <Button 
            variant="outline" 
            onClick={() => handleActionClick('academic')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'academic' 
                ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
            {t('ghost.modules.research.actions.academic')}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleActionClick('clinical')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'clinical' 
                ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <TestTube className="w-4 h-4" strokeWidth={1.5} />
            {t('ghost.modules.research.actions.clinical')}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleActionClick('preprints')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'preprints' 
                ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Files className="w-4 h-4" strokeWidth={1.5} />
            {t('ghost.modules.research.actions.preprints')}
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
                      <span className="truncate max-w-[120px]">{citation.domain}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
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
            <h3 className="text-sm font-medium text-slate-500 mb-4">{t('ghost.modules.research.exploreByCategory')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {RESEARCH_CATEGORIES.map((category) => (
                <CategoryCard
                  key={category.nameKey}
                  nameKey={category.nameKey}
                  gradientFrom={category.gradientFrom}
                  gradientTo={category.gradientTo}
                  onClick={() => setQuery(t('ghost.modules.research.latestResearchIn', { category: t(category.nameKey) }))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DiscoverLayout>
  );
}