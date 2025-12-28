import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DiscoverLayout } from '@/components/ghost/DiscoverLayout';
import { CategoryCard, LEGAL_CATEGORIES } from '@/components/ghost/CategoryCard';
import { SearchModeSelector, SourcesDropdown, type SearchMode } from '@/components/ghost/discover';
import { 
  IconScale,
  IconFileSearch,
  IconBook2,
  IconShieldCheck,
  IconArrowRight,
  IconLoader2,
  IconExternalLink,
  IconSearch
} from '@tabler/icons-react';
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

type ActionType = 'regulatory' | 'caselaw' | 'compliance';

const jurisdictions = ['EU', 'US', 'CH', 'UK'];

const getSuggestions = (action: ActionType, jurisdiction: string): string[] => {
  const suggestions: Record<ActionType, string[]> = {
    regulatory: [
      `Latest ${jurisdiction} regulatory updates for financial services`,
      `${jurisdiction} data protection compliance requirements 2024`,
      `Cross-border regulatory frameworks involving ${jurisdiction}`,
    ],
    caselaw: [
      `Recent ${jurisdiction} court decisions on data privacy`,
      `Landmark ${jurisdiction} antitrust and competition cases`,
      `${jurisdiction} employment law precedents and recent rulings`,
    ],
    compliance: [
      `GDPR compliance checklist for ${jurisdiction} operations`,
      `${jurisdiction} AML/KYC requirements for fintech`,
      `Environmental compliance regulations in ${jurisdiction}`,
    ],
  };
  return suggestions[action];
};

export default function GhostLegal() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>('search');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('EU');
  const [activeAction, setActiveAction] = useState<ActionType>('regulatory');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const searchCardRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(
    () => getSuggestions(activeAction, selectedJurisdiction),
    [activeAction, selectedJurisdiction]
  );

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchCardRef.current && !searchCardRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setResult(null);
    setShowSuggestions(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('ghost-discover', {
        body: { 
          module: 'legal', 
          query: `${query} (Jurisdiction: ${selectedJurisdiction})`,
          mode: searchMode,
          action: activeAction
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
    setQuery('');
    setResult(null);
    setShowSuggestions(true);
  };

  return (
    <DiscoverLayout activeModule="legal">
      <div className="flex-1 flex flex-col items-center justify-start pt-24 px-6">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center mb-4 shadow-sm">
            <IconScale className="w-8 h-8 text-blue-600" stroke={1.5} />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('ghost.modules.legal.title')}</h1>
        </div>

        {/* Search Card */}
        <Card ref={searchCardRef} className="w-full max-w-2xl p-5 bg-white border-slate-200/60 shadow-sm">
          {/* Mode Selector, Sources & Jurisdiction */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <SearchModeSelector mode={searchMode} onModeChange={setSearchMode} />
              <SourcesDropdown module="legal" />
            </div>

            {/* Jurisdiction Selector */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              {jurisdictions.map((j) => (
                <button
                  key={j}
                  onClick={() => setSelectedJurisdiction(j)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    selectedJurisdiction === j
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {j}
                </button>
              ))}
            </div>
          </div>
          
          {/* Search Input */}
          <div className="relative">
            <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" stroke={1.5} />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(e.target.value.length === 0);
              }}
              onFocus={() => !query && setShowSuggestions(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('ghost.modules.legal.placeholder')}
              className="h-14 text-base pl-12 pr-14 rounded-xl border-slate-200/60 bg-white shadow-sm text-slate-900 placeholder:text-slate-400"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[#2A8C86] text-white hover:bg-[#2A8C86]/90 disabled:opacity-50 transition-colors"
            >
              {isSearching ? (
                <IconLoader2 className="w-5 h-5 animate-spin" stroke={1.5} />
              ) : (
                <IconArrowRight className="w-5 h-5" stroke={1.5} />
              )}
            </button>
            
            {/* Suggestions Dropdown */}
            {showSuggestions && !query && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
                <p className="text-xs font-medium text-slate-500 px-4 py-2 border-b border-slate-100">
                  Get started with {activeAction === 'regulatory' ? 'Regulatory Search' : activeAction === 'caselaw' ? 'Case Law' : 'Compliance Check'} in {selectedJurisdiction}
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
                    <IconSearch className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" stroke={1.5} />
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
            onClick={() => handleActionClick('regulatory')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'regulatory' 
                ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <IconFileSearch className="w-4 h-4" stroke={1.5} />
            Regulatory Search
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleActionClick('caselaw')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'caselaw' 
                ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <IconBook2 className="w-4 h-4" stroke={1.5} />
            Case Law
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleActionClick('compliance')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'compliance' 
                ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <IconShieldCheck className="w-4 h-4" stroke={1.5} />
            Compliance Check
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
                      <IconExternalLink className="w-3 h-3 flex-shrink-0" stroke={1.5} />
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
            <h3 className="text-sm font-medium text-slate-500 mb-4">{t('ghost.modules.legal.exploreByCategory')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {LEGAL_CATEGORIES.map((category) => (
                <CategoryCard
                  key={category.nameKey}
                  nameKey={category.nameKey}
                  gradientFrom={category.gradientFrom}
                  gradientTo={category.gradientTo}
                  onClick={() => setQuery(t('ghost.modules.legal.regulationsIn', { category: t(category.nameKey), jurisdiction: selectedJurisdiction }))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DiscoverLayout>
  );
}
