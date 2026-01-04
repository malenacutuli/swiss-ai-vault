import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DiscoverLayout } from '@/components/ghost/DiscoverLayout';
import { SearchModeSelector, SourcesDropdown, type SearchMode } from '@/components/ghost/discover';
import { useSubscription } from '@/hooks/useSubscription';
import { 
  Building2,
  Home,
  TrendingUp,
  ArrowRight,
  Loader2,
  ExternalLink,
  Search,
  Lock,
  MapPin,
  DollarSign
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

type ActionType = 'properties' | 'market' | 'investment';

const REALESTATE_CATEGORIES = [
  { 
    nameKey: 'ghost.categories.residential', 
    gradientFrom: '#1e3a5f', 
    gradientTo: '#2d5a87',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop',
    tagline: 'Luxury homes & estates'
  },
  { 
    nameKey: 'ghost.categories.commercial', 
    gradientFrom: '#374151', 
    gradientTo: '#6b7280',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop',
    tagline: 'Office & retail spaces'
  },
  { 
    nameKey: 'ghost.categories.industrial', 
    gradientFrom: '#78350f', 
    gradientTo: '#a16207',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=300&fit=crop',
    tagline: 'Warehouses & logistics'
  },
  { 
    nameKey: 'ghost.categories.land', 
    gradientFrom: '#166534', 
    gradientTo: '#22c55e',
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop',
    tagline: 'Development opportunities'
  },
  { 
    nameKey: 'ghost.categories.international', 
    gradientFrom: '#1d4ed8', 
    gradientTo: '#3b82f6',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=300&fit=crop',
    tagline: 'Global property markets'
  },
  { 
    nameKey: 'ghost.categories.reits', 
    gradientFrom: '#7c2d12', 
    gradientTo: '#c2410c',
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop',
    tagline: 'Real estate investment trusts'
  },
];

const FEATURED_MARKETS = [
  { name: 'Swiss Alps', tagline: 'Luxury chalets & ski properties', image: 'https://images.unsplash.com/photo-1529734905203-1417e46890a6?w=400&h=300&fit=crop&q=80' },
  { name: 'Monaco', tagline: 'Ultra-prime Mediterranean', image: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=400&h=300&fit=crop&q=80' },
  { name: 'Dubai', tagline: 'Emerging luxury hub', image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=300&fit=crop&q=80' },
];

const regions = ['Global', 'US', 'Europe', 'APAC', 'LATAM', 'MENA'];

const getSuggestionKeys = (action: ActionType): string[] => {
  const suggestionKeys: Record<ActionType, string[]> = {
    properties: [
      'ghost.modules.realestate.suggestions.properties.1',
      'ghost.modules.realestate.suggestions.properties.2',
      'ghost.modules.realestate.suggestions.properties.3',
    ],
    market: [
      'ghost.modules.realestate.suggestions.market.1',
      'ghost.modules.realestate.suggestions.market.2',
      'ghost.modules.realestate.suggestions.market.3',
    ],
    investment: [
      'ghost.modules.realestate.suggestions.investment.1',
      'ghost.modules.realestate.suggestions.investment.2',
      'ghost.modules.realestate.suggestions.investment.3',
    ],
  };
  return suggestionKeys[action];
};

export default function GhostRealEstate() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isPro, isPremium, isEnterprise } = useSubscription();
  
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>('search');
  const [activeAction, setActiveAction] = useState<ActionType>('properties');
  const [selectedRegion, setSelectedRegion] = useState('Global');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const searchCardRef = useRef<HTMLDivElement>(null);

  const hasAccess = isPro || isPremium || isEnterprise;

  const suggestionKeys = useMemo(() => getSuggestionKeys(activeAction), [activeAction]);

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
    if (!query.trim() || !hasAccess) return;
    
    setIsSearching(true);
    setResult(null);
    setShowSuggestions(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('ghost-discover', {
        body: { 
          module: 'realestate', 
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

  // Pro gate
  if (!hasAccess) {
    return (
      <DiscoverLayout activeModule="realestate">
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="max-w-md p-8 text-center bg-white border-slate-200/60 shadow-lg">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              {t('ghost.modules.realestate.proRequired.title', 'Real Estate Intelligence is a Pro Feature')}
            </h2>
            <p className="text-slate-600 mb-6">
              {t('ghost.modules.realestate.proRequired.description', 'Access property market analysis, investment insights, and luxury real estate data with Ghost Pro.')}
            </p>
            <Button
              onClick={() => navigate('/ghost/pricing')}
              className="bg-[#2A8C86] hover:bg-[#2A8C86]/90"
            >
              {t('ghost.modules.realestate.proRequired.upgrade', 'Upgrade to Pro')}
            </Button>
          </Card>
        </div>
      </DiscoverLayout>
    );
  }

  return (
    <DiscoverLayout activeModule="realestate">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Building2 className="w-10 h-10 mx-auto mb-4 text-[#2A8C86]" />
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">{t('ghost.modules.realestate.title')}</h1>
          <p className="text-slate-600">{t('ghost.modules.realestate.subtitle')}</p>
        </div>

        {/* Search Card */}
        <Card ref={searchCardRef} className="relative mb-6 bg-white border-slate-200/60 shadow-sm overflow-visible">
          <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <SearchModeSelector mode={searchMode} onModeChange={setSearchMode} />
              <SourcesDropdown module="realestate" />
            </div>
            
            {/* Region Selector */}
            <div className="flex items-center gap-1">
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
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(e.target.value.length === 0);
              }}
              onFocus={() => !query && setShowSuggestions(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('ghost.modules.realestate.placeholder', 'Search properties, markets, investments...')}
              className="h-14 text-base pl-12 pr-14 rounded-xl border-slate-200/60 bg-white shadow-sm"
            />
            <Button onClick={handleSearch} size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#2A8C86] hover:bg-[#2A8C86]/90 rounded-lg">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </Button>
            
            {showSuggestions && !query && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200/60 shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-2 text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-100">
                  {t('ghost.search.getStarted')} {t(`ghost.modules.realestate.actions.${activeAction}`)}
                </div>
                {suggestionKeys.map((key, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(t(key, { region: selectedRegion })); setShowSuggestions(false); }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left text-sm text-slate-700 transition-colors border-b border-slate-50 last:border-b-0"
                  >
                    <Building2 className="w-4 h-4 mt-0.5 text-[#2A8C86]" />
                    {t(key, { region: selectedRegion })}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Button
            variant="outline"
            onClick={() => handleActionClick('properties')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'properties' ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" : "text-slate-600"
            )}
          >
            <Home className="w-4 h-4" />
            {t('ghost.modules.realestate.actions.properties')}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleActionClick('market')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'market' ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" : "text-slate-600"
            )}
          >
            <TrendingUp className="w-4 h-4" />
            {t('ghost.modules.realestate.actions.market')}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleActionClick('investment')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'investment' ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" : "text-slate-600"
            )}
          >
            <DollarSign className="w-4 h-4" />
            {t('ghost.modules.realestate.actions.investment')}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <Card className="p-6 bg-white border-slate-200/60 shadow-sm mb-8">
            <div className="prose prose-slate max-w-none">
              {result.content.split('\n').map((p, i) => p.trim() && <p key={i} className="text-slate-700 leading-relaxed mb-4">{p}</p>)}
            </div>
            {result.citations?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                {result.citations.map((c) => (
                  <a key={c.index} href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 rounded-full text-xs text-slate-600">
                    [{c.index}]
                    {c.domain}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Featured Markets */}
        {!result && (
          <>
            <div className="mb-8">
              <h2 className="text-lg font-medium text-slate-900 mb-4">{t('ghost.modules.realestate.featuredMarkets', 'Featured Markets')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {FEATURED_MARKETS.map((market) => (
                  <button
                    key={market.name}
                    onClick={() => setQuery(`Luxury properties in ${market.name}`)}
                    className="relative rounded-xl overflow-hidden group"
                  >
                    <img src={market.image} alt={market.name} className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-medium">{market.name}</h3>
                      <p className="text-white/70 text-xs">{market.tagline}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Property Categories */}
            <div>
              <h2 className="text-lg font-medium text-slate-900 mb-4">{t('ghost.modules.realestate.exploreByCategory', 'Explore by Category')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {REALESTATE_CATEGORIES.map((category) => (
                  <button
                    key={category.nameKey}
                    onClick={() => setQuery(t('ghost.modules.realestate.categorySearch', { category: t(category.nameKey), region: selectedRegion }))}
                    className="relative h-40 rounded-xl overflow-hidden group"
                  >
                    <img src={category.image} alt={t(category.nameKey)} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-medium">{t(category.nameKey)}</h3>
                      <p className="text-white/70 text-xs">{category.tagline}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </DiscoverLayout>
  );
}
