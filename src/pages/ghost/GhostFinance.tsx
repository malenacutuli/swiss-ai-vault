import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DiscoverLayout } from '@/components/ghost/DiscoverLayout';
import { MarketSparkline } from '@/components/ghost/MarketSparkline';
import { MarketSummary } from '@/components/ghost/MarketSummary';
import { WatchlistSidebar } from '@/components/ghost/WatchlistSidebar';
import { SearchModeSelector, SourcesDropdown, type SearchMode } from '@/components/ghost/discover';
import { 
  CryptoMarketView, 
  EarningsCalendarView, 
  PredictionMarketsView, 
  StockScreenerView, 
  WatchlistView,
  EuropeanMarketsView,
  SwissMarketsView,
  LatamMarketsView,
  AsiaMarketsView,
  MENAMarketsView,
  USMarketsView
} from '@/components/ghost/finance';
import { 
  TrendingUp,
  Search,
  Bell,
  ArrowRight,
  Loader2,
  ExternalLink
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
  moduleName: string;
}

const MARKET_TAB_KEYS = [
  { id: 'us', labelKey: 'ghost.modules.finance.tabs.us' },
  { id: 'european', labelKey: 'ghost.modules.finance.tabs.european' },
  { id: 'swiss', labelKey: 'ghost.modules.finance.tabs.swiss' },
  { id: 'latam', labelKey: 'ghost.modules.finance.tabs.latam' },
  { id: 'asia', labelKey: 'ghost.modules.finance.tabs.asia' },
  { id: 'mena', labelKey: 'ghost.modules.finance.tabs.mena' },
  { id: 'crypto', labelKey: 'ghost.modules.finance.tabs.crypto' },
  { id: 'earnings', labelKey: 'ghost.modules.finance.tabs.earnings' },
  { id: 'predictions', labelKey: 'ghost.modules.finance.tabs.predictions' },
  { id: 'screener', labelKey: 'ghost.modules.finance.tabs.screener' },
  { id: 'watchlist', labelKey: 'ghost.modules.finance.tabs.watchlist' },
];

const getSuggestionKeys = (activeTab: string): string[] => {
  const suggestionKeys: Record<string, string[]> = {
    us: [
      'ghost.modules.finance.suggestions.us.1',
      'ghost.modules.finance.suggestions.us.2',
      'ghost.modules.finance.suggestions.us.3',
    ],
    european: [
      'ghost.modules.finance.suggestions.european.1',
      'ghost.modules.finance.suggestions.european.2',
      'ghost.modules.finance.suggestions.european.3',
    ],
    swiss: [
      'ghost.modules.finance.suggestions.swiss.1',
      'ghost.modules.finance.suggestions.swiss.2',
      'ghost.modules.finance.suggestions.swiss.3',
    ],
    crypto: [
      'ghost.modules.finance.suggestions.crypto.1',
      'ghost.modules.finance.suggestions.crypto.2',
      'ghost.modules.finance.suggestions.crypto.3',
    ],
    default: [
      'ghost.modules.finance.suggestions.default.1',
      'ghost.modules.finance.suggestions.default.2',
      'ghost.modules.finance.suggestions.default.3',
    ],
  };
  return suggestionKeys[activeTab] || suggestionKeys.default;
};

export default function GhostFinance() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [activeTab, setActiveTab] = useState('us');
  const [searchMode, setSearchMode] = useState<SearchMode>('search');
  const [showSuggestions, setShowSuggestions] = useState(true);
  
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

  const suggestionKeys = useMemo(
    () => getSuggestionKeys(activeTab),
    [activeTab]
  );

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setResult(null);
    setShowSuggestions(false);
    try {
      const { data, error } = await supabase.functions.invoke('ghost-discover', {
        body: { module: 'finance', query, mode: searchMode, language: i18n.language },
      });
      if (error) throw error;
      setResult(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'european':
        return <EuropeanMarketsView />;
      case 'swiss':
        return <SwissMarketsView />;
      case 'latam':
        return <LatamMarketsView />;
      case 'asia':
        return <AsiaMarketsView />;
      case 'mena':
        return <MENAMarketsView />;
      case 'crypto':
        return <CryptoMarketView />;
      case 'earnings':
        return <EarningsCalendarView />;
      case 'predictions':
        return <PredictionMarketsView />;
      case 'screener':
        return <StockScreenerView />;
      case 'watchlist':
        return <WatchlistView />;
      case 'us':
      default:
        return (
          <div className="space-y-8">
            <USMarketsView />
            {result && (
              <Card className="p-6 bg-white border-slate-200/60">
                <div className="prose prose-sm max-w-none text-slate-700">
                  {result.content.split('\n').map((p, i) => p.trim() && <p key={i} className="mb-3 leading-relaxed">{p}</p>)}
                </div>
                {result.citations?.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                    {result.citations.map((c) => (
                      <a key={c.index} href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 rounded-full text-xs text-slate-600">
                        <span className="text-[#2A8C86] font-medium">[{c.index}]</span>
                        <span className="truncate max-w-[120px]">{c.domain}</span>
                        <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                      </a>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        );
    }
  };

  return (
    <DiscoverLayout activeModule="finance">
      <div className="flex-1 flex">
        <div className="flex-1 max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center shadow-sm">
                  <TrendingUp className="w-5 h-5 text-green-600" strokeWidth={1.5} />
                </div>
                <h1 className="text-xl font-semibold text-slate-900">{t('ghost.modules.finance.title')}</h1>
              </div>
              <Button variant="outline" size="sm" className="gap-2 text-slate-500 border-slate-200">
                <Bell className="w-4 h-4" strokeWidth={1.5} />{t('common.notifications')}
              </Button>
            </div>

            {/* Search Card */}
            <Card className="p-5 bg-white border-slate-200/60 shadow-sm" ref={containerRef}>
              {/* Mode Selector & Sources */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <SearchModeSelector mode={searchMode} onModeChange={setSearchMode} />
                  <SourcesDropdown module="finance" />
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
                  placeholder={t('ghost.modules.finance.placeholder')}
                  className="pl-12 pr-12 h-14 text-base rounded-xl border-slate-200/60 bg-white shadow-sm" 
                />
                <button onClick={handleSearch} disabled={isSearching} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[#2A8C86] text-white hover:bg-[#2A8C86]/90 disabled:opacity-50 transition-colors">
                  {isSearching ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.5} /> : <ArrowRight className="w-5 h-5" strokeWidth={1.5} />}
                </button>

                {/* Suggestions Dropdown */}
                {showSuggestions && !query && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
                    <p className="text-xs font-medium text-slate-500 px-4 py-2 border-b border-slate-100">
                      {t('ghost.modules.finance.suggestedFor', { market: t(MARKET_TAB_KEYS.find(tab => tab.id === activeTab)?.labelKey || 'ghost.modules.finance.tabs.us') })}
                    </p>
                    {suggestionKeys.map((key, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setQuery(t(key));
                          setShowSuggestions(false);
                        }}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left text-sm text-slate-700 transition-colors border-b border-slate-50 last:border-b-0"
                      >
                        <Search className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        <span className="line-clamp-2">{t(key)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200/60 overflow-x-auto pb-px">
              {MARKET_TAB_KEYS.map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => {
                    setActiveTab(tab.id);
                    setShowSuggestions(true);
                  }} 
                  className={cn("px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap", activeTab === tab.id ? "text-slate-900" : "text-slate-500 hover:text-slate-700")}
                >
                  {t(tab.labelKey)}
                  {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2A8C86]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {renderTabContent()}
        </div>

        <div className="hidden lg:block"><WatchlistSidebar /></div>
      </div>
    </DiscoverLayout>
  );
}