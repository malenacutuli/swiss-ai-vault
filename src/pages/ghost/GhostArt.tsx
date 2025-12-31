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
  Palette,
  Gavel,
  TrendingUp,
  Search as SearchIcon,
  ArrowRight,
  Loader2,
  ExternalLink,
  Lock,
  Sparkles
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

type ActionType = 'auctions' | 'artists' | 'investment';

const ART_CATEGORIES = [
  { 
    nameKey: 'ghost.categories.contemporaryArt', 
    gradientFrom: '#7c3aed', 
    gradientTo: '#a855f7',
    image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&h=300&fit=crop',
    tagline: 'Post-1945 to present'
  },
  { 
    nameKey: 'ghost.categories.modernArt', 
    gradientFrom: '#dc2626', 
    gradientTo: '#f87171',
    image: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=400&h=300&fit=crop',
    tagline: 'Impressionism to Abstract'
  },
  { 
    nameKey: 'ghost.categories.oldMasters', 
    gradientFrom: '#78350f', 
    gradientTo: '#b45309',
    image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=300&fit=crop',
    tagline: 'Renaissance to 18th century'
  },
  { 
    nameKey: 'ghost.categories.photography', 
    gradientFrom: '#1f2937', 
    gradientTo: '#4b5563',
    image: 'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=400&h=300&fit=crop',
    tagline: 'Fine art photography'
  },
  { 
    nameKey: 'ghost.categories.sculpture', 
    gradientFrom: '#0e7490', 
    gradientTo: '#22d3ee',
    image: 'https://images.unsplash.com/photo-1544413660-299165566b1d?w=400&h=300&fit=crop',
    tagline: '3D works & installations'
  },
  { 
    nameKey: 'ghost.categories.digitalArt', 
    gradientFrom: '#4f46e5', 
    gradientTo: '#818cf8',
    image: 'https://images.unsplash.com/photo-1634017839464-5c339bbe3c35?w=400&h=300&fit=crop',
    tagline: 'NFTs & digital collectibles'
  },
];

const UPCOMING_AUCTIONS = [
  { house: "Christie's", title: 'Post-War & Contemporary Art', date: 'Jan 15, 2025', location: 'New York' },
  { house: "Sotheby's", title: 'Impressionist & Modern Art', date: 'Jan 22, 2025', location: 'London' },
  { house: 'Phillips', title: '20th Century & Contemporary', date: 'Feb 3, 2025', location: 'Hong Kong' },
];

const getSuggestionKeys = (action: ActionType): string[] => {
  const suggestionKeys: Record<ActionType, string[]> = {
    auctions: [
      'ghost.modules.art.suggestions.auctions.1',
      'ghost.modules.art.suggestions.auctions.2',
      'ghost.modules.art.suggestions.auctions.3',
    ],
    artists: [
      'ghost.modules.art.suggestions.artists.1',
      'ghost.modules.art.suggestions.artists.2',
      'ghost.modules.art.suggestions.artists.3',
    ],
    investment: [
      'ghost.modules.art.suggestions.investment.1',
      'ghost.modules.art.suggestions.investment.2',
      'ghost.modules.art.suggestions.investment.3',
    ],
  };
  return suggestionKeys[action];
};

export default function GhostArt() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isPro, isPremium, isEnterprise } = useSubscription();
  
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>('search');
  const [activeAction, setActiveAction] = useState<ActionType>('auctions');
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
          module: 'art', 
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
      <DiscoverLayout activeModule="art">
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md p-8 text-center space-y-6 bg-card border-border">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#2A8C86]/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-[#2A8C86]" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {t('ghost.modules.art.proRequired.title', 'Art Intelligence is a Pro Feature')}
            </h2>
            <p className="text-muted-foreground">
              {t('ghost.modules.art.proRequired.description', 'Access auction insights, artist market analysis, and art investment intelligence with Ghost Pro.')}
            </p>
            <Button 
              onClick={() => navigate('/ghost/pricing')}
              className="bg-[#2A8C86] hover:bg-[#2A8C86]/90"
            >
              {t('ghost.modules.art.proRequired.upgrade', 'Upgrade to Pro')}
            </Button>
          </Card>
        </div>
      </DiscoverLayout>
    );
  }

  return (
    <DiscoverLayout activeModule="art">
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 pb-4">
          <Palette className="w-6 h-6 text-[#2A8C86]" />
          <h1 className="text-xl font-semibold text-foreground">{t('ghost.modules.art.title')}</h1>
          <p className="text-sm text-muted-foreground ml-2">{t('ghost.modules.art.subtitle')}</p>
        </div>

        {/* Search Card */}
        <Card ref={searchCardRef} className="mx-6 mb-6 bg-card border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <SearchModeSelector mode={searchMode} onModeChange={setSearchMode} />
              <SourcesDropdown module="art" />
            </div>
          </div>
          
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(e.target.value.length === 0);
              }}
              onFocus={() => !query && setShowSuggestions(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('ghost.modules.art.placeholder', 'Search artists, auctions, market trends...')}
              className="h-14 text-base pl-12 pr-14 rounded-none border-0 bg-transparent focus-visible:ring-0"
            />
            <Button
              size="icon"
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-[#2A8C86] hover:bg-[#2A8C86]/90"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </Button>
            
            {showSuggestions && !query && (
              <div className="absolute top-full left-0 right-0 bg-card border-t border-border shadow-lg z-10">
                <p className="px-4 py-2 text-xs text-muted-foreground">
                  {t('ghost.search.getStarted')} {t(`ghost.modules.art.actions.${activeAction}`)}
                </p>
                {suggestionKeys.map((key, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(t(key)); setShowSuggestions(false); }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 text-left text-sm text-foreground transition-colors border-b border-border/50 last:border-b-0"
                  >
                    <Sparkles className="w-4 h-4 text-[#2A8C86] mt-0.5 shrink-0" />
                    {t(key)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 px-6 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick('auctions')}
            className={cn(
              "gap-2 rounded-full border-border transition-all",
              activeAction === 'auctions' ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" : "text-muted-foreground"
            )}
          >
            <Gavel className="w-4 h-4" />
            {t('ghost.modules.art.actions.auctions')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick('artists')}
            className={cn(
              "gap-2 rounded-full border-border transition-all",
              activeAction === 'artists' ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" : "text-muted-foreground"
            )}
          >
            <Palette className="w-4 h-4" />
            {t('ghost.modules.art.actions.artists')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick('investment')}
            className={cn(
              "gap-2 rounded-full border-border transition-all",
              activeAction === 'investment' ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" : "text-muted-foreground"
            )}
          >
            <TrendingUp className="w-4 h-4" />
            {t('ghost.modules.art.actions.investment')}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <Card className="mx-6 mb-6 p-6 bg-card border-border">
            <div className="prose prose-sm max-w-none text-foreground">
              {result.content.split('\n').map((p, i) => p.trim() && <p key={i}>{p}</p>)}
            </div>
            {result.citations?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                {result.citations.map((c) => (
                  <a key={c.index} href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded">
                    <span className="text-[#2A8C86]">[{c.index}]</span>
                    <span>{c.domain}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Upcoming Auctions */}
        {!result && (
          <>
            <div className="px-6 mb-6">
              <h2 className="text-sm font-medium text-foreground mb-4">{t('ghost.modules.art.upcomingAuctions', 'Upcoming Auctions')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {UPCOMING_AUCTIONS.map((auction, i) => (
                  <Card 
                    key={i}
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors bg-card border-border"
                    onClick={() => setQuery(`${auction.house} ${auction.title} auction results`)}
                  >
                    <p className="text-xs font-medium text-[#2A8C86]">{auction.house}</p>
                    <p className="text-sm font-medium text-foreground mt-1">{auction.title}</p>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{auction.date}</span>
                      <span>{auction.location}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div className="px-6 pb-6">
              <h2 className="text-sm font-medium text-foreground mb-4">{t('ghost.modules.art.exploreByCategory', 'Explore by Category')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {ART_CATEGORIES.map((category) => (
                  <button
                    key={category.nameKey}
                    onClick={() => setQuery(t('ghost.modules.art.marketTrendsIn', { category: t(category.nameKey) }))}
                    className="relative h-36 rounded-xl overflow-hidden group"
                  >
                    <img src={category.image} alt={t(category.nameKey)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-end p-3">
                      <p className="text-white text-sm font-medium">{t(category.nameKey)}</p>
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
