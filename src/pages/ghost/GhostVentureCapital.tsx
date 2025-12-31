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
  Rocket,
  TrendingUp,
  Users,
  Briefcase,
  Target,
  Lightbulb,
  Search as SearchIcon,
  ArrowRight,
  Loader2,
  ExternalLink,
  Lock,
  DollarSign,
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

type ActionType = 'deals' | 'startups' | 'investors';

const VC_CATEGORIES = [
  { 
    nameKey: 'ghost.categories.aiMl', 
    gradientFrom: '#4f46e5', 
    gradientTo: '#818cf8',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=300&fit=crop',
    tagline: 'AI/ML & Deep Tech'
  },
  { 
    nameKey: 'ghost.categories.fintech', 
    gradientFrom: '#059669', 
    gradientTo: '#34d399',
    image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&h=300&fit=crop',
    tagline: 'Payments, Banking, DeFi'
  },
  { 
    nameKey: 'ghost.categories.healthtech', 
    gradientFrom: '#dc2626', 
    gradientTo: '#f87171',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=300&fit=crop',
    tagline: 'Digital Health & Biotech'
  },
  { 
    nameKey: 'ghost.categories.climatetech', 
    gradientFrom: '#16a34a', 
    gradientTo: '#4ade80',
    image: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=300&fit=crop',
    tagline: 'Clean Energy & Sustainability'
  },
  { 
    nameKey: 'ghost.categories.saas', 
    gradientFrom: '#0891b2', 
    gradientTo: '#22d3ee',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
    tagline: 'Enterprise & B2B Software'
  },
  { 
    nameKey: 'ghost.categories.web3', 
    gradientFrom: '#7c3aed', 
    gradientTo: '#a78bfa',
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=300&fit=crop',
    tagline: 'Blockchain & Crypto'
  },
];

const RECENT_ROUNDS = [
  { company: 'OpenAI', round: 'Series D', amount: '$6.6B', stage: 'Late', sector: 'AI' },
  { company: 'Stripe', round: 'Series I', amount: '$6.5B', stage: 'Late', sector: 'Fintech' },
  { company: 'Anthropic', round: 'Series D', amount: '$4B', stage: 'Late', sector: 'AI' },
];

const REGIONS = ['Global', 'US', 'Europe', 'Asia', 'LATAM', 'MENA'];
const STAGES = ['All Stages', 'Pre-Seed', 'Seed', 'Series A', 'Series B+', 'Growth'];

const getSuggestionKeys = (action: ActionType): string[] => {
  const suggestionKeys: Record<ActionType, string[]> = {
    deals: [
      'ghost.modules.vc.suggestions.deals.1',
      'ghost.modules.vc.suggestions.deals.2',
      'ghost.modules.vc.suggestions.deals.3',
    ],
    startups: [
      'ghost.modules.vc.suggestions.startups.1',
      'ghost.modules.vc.suggestions.startups.2',
      'ghost.modules.vc.suggestions.startups.3',
    ],
    investors: [
      'ghost.modules.vc.suggestions.investors.1',
      'ghost.modules.vc.suggestions.investors.2',
      'ghost.modules.vc.suggestions.investors.3',
    ],
  };
  return suggestionKeys[action];
};

export default function GhostVentureCapital() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isPro, isPremium, isEnterprise } = useSubscription();
  
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>('search');
  const [selectedRegion, setSelectedRegion] = useState('Global');
  const [selectedStage, setSelectedStage] = useState('All Stages');
  const [activeAction, setActiveAction] = useState<ActionType>('deals');
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
          module: 'vc', 
          query: `${query} (Region: ${selectedRegion}, Stage: ${selectedStage})`,
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
      <DiscoverLayout activeModule="vc">
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md p-8 text-center space-y-6 bg-card border-border">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#2A8C86]/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-[#2A8C86]" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {t('ghost.modules.vc.proRequired.title', 'Venture Capital Intelligence is a Pro Feature')}
            </h2>
            <p className="text-muted-foreground">
              {t('ghost.modules.vc.proRequired.description', 'Access deal flow insights, startup intelligence, and investor tracking with Ghost Pro.')}
            </p>
            <Button 
              onClick={() => navigate('/ghost/pricing')}
              className="bg-[#2A8C86] hover:bg-[#2A8C86]/90"
            >
              {t('ghost.modules.vc.proRequired.upgrade', 'Upgrade to Pro')}
            </Button>
          </Card>
        </div>
      </DiscoverLayout>
    );
  }

  return (
    <DiscoverLayout activeModule="vc">
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 pb-4">
          <Rocket className="w-6 h-6 text-[#2A8C86]" />
          <h1 className="text-xl font-semibold text-foreground">{t('ghost.modules.vc.title')}</h1>
          <p className="text-sm text-muted-foreground ml-2">{t('ghost.modules.vc.subtitle')}</p>
        </div>

        {/* Search Card */}
        <Card ref={searchCardRef} className="mx-6 mb-6 bg-card border-border overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <SearchModeSelector mode={searchMode} onModeChange={setSearchMode} />
              <SourcesDropdown module="vc" />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md border border-border bg-background text-foreground"
              >
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md border border-border bg-background text-foreground"
              >
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
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
              placeholder={t('ghost.modules.vc.placeholder', 'Search deals, startups, investors, sectors...')}
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
                  {t('ghost.search.getStarted')} {t(`ghost.modules.vc.actions.${activeAction}`)}
                </p>
                {suggestionKeys.map((key, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(t(key, { region: selectedRegion })); setShowSuggestions(false); }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 text-left text-sm text-foreground transition-colors border-b border-border/50 last:border-b-0"
                  >
                    <Sparkles className="w-4 h-4 text-[#2A8C86] mt-0.5 shrink-0" />
                    {t(key, { region: selectedRegion })}
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
            onClick={() => handleActionClick('deals')}
            className={cn(
              "gap-2 rounded-full border-border transition-all",
              activeAction === 'deals' ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" : "text-muted-foreground"
            )}
          >
            <DollarSign className="w-4 h-4" />
            {t('ghost.modules.vc.actions.deals')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick('startups')}
            className={cn(
              "gap-2 rounded-full border-border transition-all",
              activeAction === 'startups' ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" : "text-muted-foreground"
            )}
          >
            <Rocket className="w-4 h-4" />
            {t('ghost.modules.vc.actions.startups')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick('investors')}
            className={cn(
              "gap-2 rounded-full border-border transition-all",
              activeAction === 'investors' ? "bg-[#2A8C86]/10 border-[#2A8C86]/30 text-[#2A8C86]" : "text-muted-foreground"
            )}
          >
            <Users className="w-4 h-4" />
            {t('ghost.modules.vc.actions.investors')}
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

        {/* Recent Funding Rounds */}
        {!result && (
          <>
            <div className="px-6 mb-6">
              <h2 className="text-sm font-medium text-foreground mb-4">{t('ghost.modules.vc.recentRounds', 'Recent Major Rounds')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {RECENT_ROUNDS.map((round, i) => (
                  <Card 
                    key={i}
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors bg-card border-border"
                    onClick={() => setQuery(`${round.company} funding round details`)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{round.company}</p>
                      <span className="text-xs bg-[#2A8C86]/10 text-[#2A8C86] px-2 py-0.5 rounded">{round.sector}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">{round.round}</span>
                      <span className="text-sm font-medium text-[#2A8C86]">{round.amount}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Sector Categories */}
            <div className="px-6 pb-6">
              <h2 className="text-sm font-medium text-foreground mb-4">{t('ghost.modules.vc.exploreBySector', 'Explore by Sector')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {VC_CATEGORIES.map((category) => (
                  <button
                    key={category.nameKey}
                    onClick={() => setQuery(t('ghost.modules.vc.dealsIn', { sector: t(category.nameKey), region: selectedRegion }))}
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
