import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DiscoverLayout } from '@/components/ghost/DiscoverLayout';
import { MarketSparkline } from '@/components/ghost/MarketSparkline';
import { MarketSummary } from '@/components/ghost/MarketSummary';
import { WatchlistSidebar } from '@/components/ghost/WatchlistSidebar';
import { 
  CryptoMarketView, 
  EarningsCalendarView, 
  PredictionMarketsView, 
  StockScreenerView, 
  WatchlistView 
} from '@/components/ghost/finance';
import { 
  TrendingUp, Search, Bell, ArrowRight, 
  Loader2, ExternalLink
} from 'lucide-react';
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
  { id: 'crypto', label: 'Crypto' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'predictions', label: 'Predictions' },
  { id: 'screener', label: 'Screener' },
  { id: 'watchlist', label: 'Watchlist' },
];

export default function GhostFinance() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [activeTab, setActiveTab] = useState('us');
  
  const marketData: MarketTicker[] = [
    { symbol: 'SPY', name: 'S&P 500', price: 6012.45, change: -15.23, changePercent: -0.25 },
    { symbol: 'QQQ', name: 'NASDAQ', price: 21543.20, change: 45.67, changePercent: 0.21 },
    { symbol: 'DIA', name: 'Dow Jones', price: 43789.50, change: -89.12, changePercent: -0.20 },
    { symbol: 'VIX', name: 'VIX', price: 13.45, change: 0.34, changePercent: 2.59 },
  ];

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('ghost-discover', {
        body: { module: 'finance', query },
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
                        <ExternalLink className="w-3 h-3" />
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
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-slate-500" />
                </div>
                <h1 className="text-xl font-semibold text-slate-900">Finance</h1>
              </div>
              <Button variant="outline" size="sm" className="gap-2 text-slate-500 border-slate-200">
                <Bell className="w-4 h-4" />Price Alert
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Search for stocks, crypto, and more..." className="pl-12 pr-12 h-12 text-base rounded-xl border-slate-200/60 bg-white shadow-sm" />
              <button onClick={handleSearch} disabled={isSearching} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-slate-100">
                {isSearching ? <Loader2 className="w-5 h-5 text-[#2A8C86] animate-spin" /> : <ArrowRight className="w-5 h-5 text-[#2A8C86]" />}
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200/60">
              {MARKET_TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("px-4 py-2.5 text-sm font-medium transition-colors relative", activeTab === tab.id ? "text-slate-900" : "text-slate-500 hover:text-slate-700")}>
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
