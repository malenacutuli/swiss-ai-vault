import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DiscoverLayout } from '@/components/ghost/DiscoverLayout';
import { CategoryCard } from '@/components/ghost/CategoryCard';
import { SearchModeSelector, SourcesDropdown, type SearchMode } from '@/components/ghost/discover';
import { 
  Shield,
  AlertTriangle,
  Lock,
  Eye,
  ArrowRight,
  Loader2,
  ExternalLink,
  Search,
  Globe
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

type ActionType = 'threats' | 'vulnerabilities' | 'privacy';

// Security-specific category cards
export const SECURITY_CATEGORIES = [
  { 
    nameKey: 'ghost.categories.ransomware', 
    gradientFrom: '#1a1a2e', 
    gradientTo: '#16213e',
  },
  { 
    nameKey: 'ghost.categories.dataBreaches', 
    gradientFrom: '#0f3460', 
    gradientTo: '#1a1a2e',
  },
  { 
    nameKey: 'ghost.categories.phishing', 
    gradientFrom: '#1e3a5f', 
    gradientTo: '#2d5a87',
  },
  { 
    nameKey: 'ghost.categories.zeroDay', 
    gradientFrom: '#2c3e50', 
    gradientTo: '#34495e',
  },
  { 
    nameKey: 'ghost.categories.nationState', 
    gradientFrom: '#1a252f', 
    gradientTo: '#2c3e50',
  },
  { 
    nameKey: 'ghost.categories.cryptoSecurity', 
    gradientFrom: '#0d1b2a', 
    gradientTo: '#1b263b',
  },
];

const regions = ['Global', 'US', 'EU', 'APAC', 'LATAM', 'MENA'];

const getSuggestionKeys = (action: ActionType): string[] => {
  const suggestionKeys: Record<ActionType, string[]> = {
    threats: [
      'ghost.modules.security.suggestions.threats.1',
      'ghost.modules.security.suggestions.threats.2',
      'ghost.modules.security.suggestions.threats.3',
    ],
    vulnerabilities: [
      'ghost.modules.security.suggestions.vulnerabilities.1',
      'ghost.modules.security.suggestions.vulnerabilities.2',
      'ghost.modules.security.suggestions.vulnerabilities.3',
    ],
    privacy: [
      'ghost.modules.security.suggestions.privacy.1',
      'ghost.modules.security.suggestions.privacy.2',
      'ghost.modules.security.suggestions.privacy.3',
    ],
  };
  return suggestionKeys[action];
};

export default function GhostSecurity() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>('search');
  const [selectedRegion, setSelectedRegion] = useState('Global');
  const [activeAction, setActiveAction] = useState<ActionType>('threats');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const searchCardRef = useRef<HTMLDivElement>(null);

  const suggestionKeys = useMemo(
    () => getSuggestionKeys(activeAction),
    [activeAction]
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
          module: 'security', 
          query: `${query} (Region: ${selectedRegion})`,
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
    setQuery('');
    setResult(null);
    setShowSuggestions(true);
  };

  return (
    <DiscoverLayout activeModule="security">
      <div className="flex-1 flex flex-col items-center justify-start pt-24 px-6">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <Shield className="w-10 h-10 text-swiss-teal mb-4" strokeWidth={1.25} />
          <h1 className="text-2xl font-semibold text-slate-900">{t('ghost.modules.security.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('ghost.modules.security.subtitle')}</p>
        </div>

        {/* Search Card */}
        <Card ref={searchCardRef} className="w-full max-w-2xl p-5 bg-white border-slate-200/60 shadow-sm">
          {/* Mode Selector, Sources & Region */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <SearchModeSelector mode={searchMode} onModeChange={setSearchMode} />
              <SourcesDropdown module="security" />
            </div>

            {/* Region Selector */}
            <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
              {regions.slice(0, 4).map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRegion(r)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    selectedRegion === r
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {r}
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
                setShowSuggestions(e.target.value.length === 0);
              }}
              onFocus={() => !query && setShowSuggestions(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('ghost.modules.security.placeholder')}
              className="h-14 text-base pl-12 pr-14 rounded-xl border-slate-200/60 bg-white shadow-sm text-slate-900 placeholder:text-slate-400"
            />
            <button 
              onClick={handleSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-swiss-teal hover:bg-swiss-teal/90 rounded-lg flex items-center justify-center transition-colors"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 text-white" />
              )}
            </button>
            
            {/* Suggestions Dropdown */}
            {showSuggestions && !query && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-slate-200/60 shadow-lg overflow-hidden z-20">
                <div className="px-4 py-3 border-b border-slate-100">
                  <span className="text-xs text-slate-500">
                    {t('ghost.search.getStarted')} {t(`ghost.modules.security.actions.${activeAction}`)}
                  </span>
                </div>
                {suggestionKeys.map((key, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(t(key, { region: selectedRegion }));
                      setShowSuggestions(false);
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left text-sm text-slate-700 transition-colors border-b border-slate-50 last:border-b-0"
                  >
                    <Search className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    {t(key, { region: selectedRegion })}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-6">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleActionClick('threats')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'threats' 
                ? "bg-swiss-teal/10 border-swiss-teal/30 text-swiss-teal" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <AlertTriangle className="w-4 h-4" />
            {t('ghost.modules.security.actions.threats')}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleActionClick('vulnerabilities')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'vulnerabilities' 
                ? "bg-swiss-teal/10 border-swiss-teal/30 text-swiss-teal" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Shield className="w-4 h-4" />
            {t('ghost.modules.security.actions.vulnerabilities')}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleActionClick('privacy')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'privacy' 
                ? "bg-swiss-teal/10 border-swiss-teal/30 text-swiss-teal" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Eye className="w-4 h-4" />
            {t('ghost.modules.security.actions.privacy')}
          </Button>
        </div>

        {/* Search Result */}
        {result && (
          <Card className="w-full max-w-2xl mt-8 p-6 bg-white border-slate-200/60 shadow-sm">
            <div className="prose prose-slate prose-sm max-w-none">
              {result.content.split('\n').map((paragraph, i) => (
                paragraph.trim() && (
                  <p key={i} className="text-slate-700 leading-relaxed">
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
                      [{citation.index}]
                      {citation.domain}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Categories */}
        {!result && (
          <div className="w-full max-w-2xl mt-12">
            <h2 className="text-sm font-medium text-slate-500 mb-4">{t('ghost.modules.security.exploreByCategory')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {SECURITY_CATEGORIES.map((category) => (
                <CategoryCard
                  key={category.nameKey}
                  nameKey={category.nameKey}
                  gradientFrom={category.gradientFrom}
                  gradientTo={category.gradientTo}
                  onClick={() => setQuery(t('ghost.modules.security.threatsIn', { category: t(category.nameKey) }))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DiscoverLayout>
  );
}
