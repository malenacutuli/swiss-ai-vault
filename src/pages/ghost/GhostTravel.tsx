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
  Plane,
  Hotel,
  Compass,
  Star,
  ArrowRight,
  Loader2,
  ExternalLink,
  Search,
  Lock,
  MapPin
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

type ActionType = 'destinations' | 'hotels' | 'experiences';

const TRAVEL_CATEGORIES = [
  { 
    nameKey: 'ghost.categories.europe', 
    gradientFrom: '#1e3a5f', 
    gradientTo: '#2d5a87',
    image: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&h=300&fit=crop',
    tagline: 'Castles, culture, cuisine'
  },
  { 
    nameKey: 'ghost.categories.asia', 
    gradientFrom: '#7c2d12', 
    gradientTo: '#c2410c',
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&h=300&fit=crop',
    tagline: 'Ancient traditions, modern luxury'
  },
  { 
    nameKey: 'ghost.categories.caribbean', 
    gradientFrom: '#0e7490', 
    gradientTo: '#22d3ee',
    image: 'https://images.unsplash.com/photo-1580541631950-7282082b03fe?w=400&h=300&fit=crop',
    tagline: 'Private islands, pristine beaches'
  },
  { 
    nameKey: 'ghost.categories.middleEast', 
    gradientFrom: '#92400e', 
    gradientTo: '#d97706',
    image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=300&fit=crop',
    tagline: 'Desert luxury, architectural wonders'
  },
  { 
    nameKey: 'ghost.categories.africa', 
    gradientFrom: '#166534', 
    gradientTo: '#22c55e',
    image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&h=300&fit=crop',
    tagline: 'Safari experiences, natural beauty'
  },
  { 
    nameKey: 'ghost.categories.oceania', 
    gradientFrom: '#1d4ed8', 
    gradientTo: '#3b82f6',
    image: 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=400&h=300&fit=crop',
    tagline: 'Remote escapes, pristine nature'
  },
];

const TRENDING_DESTINATIONS = [
  { name: 'Barcelona', tagline: 'Gaudi, beaches, tapas', image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400&h=300&fit=crop' },
  { name: 'Edinburgh', tagline: 'Castles, dramatic landscapes', image: 'https://images.unsplash.com/photo-1566041510394-cf7c8fe21800?w=400&h=300&fit=crop' },
  { name: 'Kyoto', tagline: 'Temples, gardens, tradition', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&h=300&fit=crop' },
];

const getSuggestionKeys = (action: ActionType): string[] => {
  const suggestionKeys: Record<ActionType, string[]> = {
    destinations: [
      'ghost.modules.travel.suggestions.destinations.1',
      'ghost.modules.travel.suggestions.destinations.2',
      'ghost.modules.travel.suggestions.destinations.3',
    ],
    hotels: [
      'ghost.modules.travel.suggestions.hotels.1',
      'ghost.modules.travel.suggestions.hotels.2',
      'ghost.modules.travel.suggestions.hotels.3',
    ],
    experiences: [
      'ghost.modules.travel.suggestions.experiences.1',
      'ghost.modules.travel.suggestions.experiences.2',
      'ghost.modules.travel.suggestions.experiences.3',
    ],
  };
  return suggestionKeys[action];
};

export default function GhostTravel() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isPro, isPremium, isEnterprise } = useSubscription();
  
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>('search');
  const [activeAction, setActiveAction] = useState<ActionType>('destinations');
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
          module: 'travel', 
          query,
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
      <DiscoverLayout activeModule="travel">
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="max-w-md p-8 text-center bg-white border-slate-200/60 shadow-lg">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-cyan-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              {t('ghost.modules.travel.proRequired.title', 'Travel Intelligence is a Pro Feature')}
            </h2>
            <p className="text-slate-600 mb-6">
              {t('ghost.modules.travel.proRequired.description', 'Access luxury travel planning, destination insights, and exclusive experiences with Ghost Pro.')}
            </p>
            <Button
              onClick={() => navigate('/ghost/pricing')}
              className="bg-[#2A8C86] hover:bg-[#2A8C86]/90"
            >
              {t('ghost.modules.travel.proRequired.upgrade', 'Upgrade to Pro')}
            </Button>
          </Card>
        </div>
      </DiscoverLayout>
    );
  }

  return (
    <DiscoverLayout activeModule="travel">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Plane className="w-10 h-10 mx-auto mb-4 text-[#2A8C86]" />
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">{t('ghost.modules.travel.title')}</h1>
        </div>

        {/* Search Card */}
        <Card ref={searchCardRef} className="relative mb-6 bg-white border-slate-200/60 shadow-sm overflow-visible">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <SearchModeSelector mode={searchMode} onModeChange={setSearchMode} />
              <SourcesDropdown module="travel" />
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
              placeholder={t('ghost.modules.travel.placeholder', 'Ask anything...')}
              className="h-14 text-base pl-12 pr-14 rounded-xl border-slate-200/60 bg-white shadow-sm"
            />
            <Button onClick={handleSearch} size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#2A8C86] hover:bg-[#2A8C86]/90 rounded-lg">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </Button>
            
            {showSuggestions && !query && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200/60 shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-2 text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-100">
                  {t('ghost.search.getStarted')} {t(`ghost.modules.travel.actions.${activeAction}`)}
                </div>
                {suggestionKeys.map((key, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(t(key)); setShowSuggestions(false); }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left text-sm text-slate-700 transition-colors border-b border-slate-50 last:border-b-0"
                  >
                    <Compass className="w-4 h-4 mt-0.5 text-[#2A8C86]" />
                    {t(key)}
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
            onClick={() => handleActionClick('destinations')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'destinations' ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" : "text-slate-600"
            )}
          >
            <MapPin className="w-4 h-4" />
            {t('ghost.modules.travel.actions.destinations')}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleActionClick('hotels')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'hotels' ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" : "text-slate-600"
            )}
          >
            <Hotel className="w-4 h-4" />
            {t('ghost.modules.travel.actions.hotels')}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleActionClick('experiences')}
            className={cn(
              "gap-2 rounded-full border-slate-200 transition-all",
              activeAction === 'experiences' ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" : "text-slate-600"
            )}
          >
            <Star className="w-4 h-4" />
            {t('ghost.modules.travel.actions.experiences')}
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

        {/* Trending Destinations */}
        {!result && (
          <>
            <div className="mb-8">
              <h2 className="text-lg font-medium text-slate-900 mb-4">{t('ghost.modules.travel.trendingDestinations', 'Trending Destinations')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TRENDING_DESTINATIONS.map((dest) => (
                  <button
                    key={dest.name}
                    onClick={() => setQuery(`Best things to do in ${dest.name}`)}
                    className="relative rounded-xl overflow-hidden group"
                  >
                    <img src={dest.image} alt={dest.name} className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-medium">{dest.name}</h3>
                      <p className="text-white/70 text-xs">{dest.tagline}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Inspiration Section */}
            <div>
              <h2 className="text-lg font-medium text-slate-900 mb-4">{t('ghost.modules.travel.inspiration', 'Inspiration')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {TRAVEL_CATEGORIES.map((category) => (
                  <button
                    key={category.nameKey}
                    onClick={() => setQuery(t('ghost.modules.travel.exploreRegion', { region: t(category.nameKey) }))}
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
