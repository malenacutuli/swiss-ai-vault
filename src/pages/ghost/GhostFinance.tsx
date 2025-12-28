import { useState, useMemo, useRef, useEffect } from 'react';
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
  MENAMarketsView
} from '@/components/ghost/finance';
import { 
  IconTrendingUp,
  IconSearch,
  IconBell,
  IconArrowRight,
  IconLoader2,
  IconExternalLink
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface MarketTicker {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

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

const MARKET_TABS = [
  { id: 'us', label: 'US Markets' },
  { id: 'european', label: 'European' },
  { id: 'swiss', label: 'Swiss' },
  { id: 'latam', label: 'LatAm' },
  { id: 'asia', label: 'Asia' },
  { id: 'mena', label: 'MENA' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'predictions', label: 'Predictions' },
  { id: 'screener', label: 'Screener' },
  { id: 'watchlist', label: 'Watchlist' },
];

const getSuggestions = (activeTab: string): string[] => {
  const suggestions: Record<string, string[]> = {
    us: [
      'What are the top performing S&P 500 stocks this week?',
      'Analysis of Federal Reserve interest rate decision impact',
      'Tech sector earnings preview for Q4 2024',
    ],
    european: [
      'How is the ECB policy affecting European markets?',
      'Top performing European stocks in 2024',
      'Euro Stoxx 50 technical analysis',
    ],
    swiss: [
      'SMI index performance and outlook',
      'Swiss franc impact on Swiss equities',
      'Top Swiss dividend stocks for 2024',
    ],
    crypto: [
      'Bitcoin price prediction and analysis',
      'Top altcoins to watch in 2024',
      'Impact of ETF approvals on crypto markets',
    ],
    default: [
      'What are the best investment opportunities right now?',
      'Market sentiment analysis for this week',
      'Portfolio diversification strategies',
    ],
  };
  return suggestions[activeTab] || suggestions.default;
};

export default function GhostFinance() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [activeTab, setActiveTab] = useState('us');
  const [searchMode, setSearchMode] = useState<SearchMode>('search');
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  const marketData: MarketTicker[] = [
    { symbol: 'SPY', name: 'S&P 500', price: 6012.45, change: -15.23, changePercent: -0.25 },
    { symbol: 'QQQ', name: 'NASDAQ', price: 21543.20, change: 45.67, changePercent: 0.21 },
    { symbol: 'DIA', name: 'Dow Jones', price: 43789.50, change: -89.12, changePercent: -0.20 },
    { symbol: 'VIX', name: 'VIX', price: 13.45, change: 0.34, changePercent: 2.59 },
  ];

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
    () => getSuggestions(activeTab),
    [activeTab]
  );

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setResult(null);
    setShowSuggestions(false);
    try {
      const { data, error } = await supabase.functions.invoke('ghost-discover', {
        body: { module: 'finance', query, mode: searchMode },
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
      default:
        return (
          <div className="space-y-8">
            {/* Market Tickers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {marketData.map((ticker) => (
                <Card key={ticker.symbol} className="p-4 bg-white border-slate-200/60 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-500">{ticker.name}</span>
                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", ticker.changePercent >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                      {ticker.changePercent >= 0 ? '↑' : '↓'} {Math.abs(ticker.changePercent).toFixed(2)}%
                    </span>
                  </div>
                  <div className="my-2"><MarketSparkline changePercent={ticker.changePercent} /></div>
                  <div className="flex items-end justify-between">
                    <div className="text-xl font-semibold text-slate-900">{ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <p className={cn("text-sm font-medium", ticker.change >= 0 ? "text-green-600" : "text-red-600")}>
                      {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(2)}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
            {result ? (
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
                        <IconExternalLink className="w-3 h-3" stroke={1.5} />
                      </a>
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <MarketSummary />
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
                  <IconTrendingUp className="w-5 h-5 text-green-600" stroke={1.5} />
                </div>
                <h1 className="text-xl font-semibold text-slate-900">Finance</h1>
              </div>
              <Button variant="outline" size="sm" className="gap-2 text-slate-500 border-slate-200">
                <IconBell className="w-4 h-4" stroke={1.5} />Price Alert
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
                <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" stroke={1.5} />
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
                  placeholder="Ask about markets, stocks, crypto..." 
                  className="pl-12 pr-12 h-14 text-base rounded-xl border-slate-200/60 bg-white shadow-sm" 
                />
                <button onClick={handleSearch} disabled={isSearching} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-[#2A8C86] text-white hover:bg-[#2A8C86]/90 disabled:opacity-50 transition-colors">
                  {isSearching ? <IconLoader2 className="w-5 h-5 animate-spin" stroke={1.5} /> : <IconArrowRight className="w-5 h-5" stroke={1.5} />}
                </button>

                {/* Suggestions Dropdown */}
                {showSuggestions && !query && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
                    <p className="text-xs font-medium text-slate-500 px-4 py-2 border-b border-slate-100">
                      Suggested questions for {MARKET_TABS.find(t => t.id === activeTab)?.label || 'Markets'}
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

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200/60 overflow-x-auto pb-px">
              {MARKET_TABS.map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => {
                    setActiveTab(tab.id);
                    setShowSuggestions(true);
                  }} 
                  className={cn("px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap", activeTab === tab.id ? "text-slate-900" : "text-slate-500 hover:text-slate-700")}
                >
                  {tab.label}
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