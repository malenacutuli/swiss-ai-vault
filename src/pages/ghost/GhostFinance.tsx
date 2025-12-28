import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { SimpleSidebar } from '@/components/layout/SimpleSidebar';
import { 
  TrendingUp, Search, Star, Bell, ArrowRight, 
  Loader2, ExternalLink, RefreshCw, ArrowLeft
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

export default function GhostFinance() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [activeTab, setActiveTab] = useState('markets');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Sample market data - in production, fetch from API
  const marketData: MarketTicker[] = [
    { symbol: 'SPY', name: 'S&P 500', price: 6012.45, change: -15.23, changePercent: -0.25 },
    { symbol: 'QQQ', name: 'NASDAQ', price: 21543.20, change: 45.67, changePercent: 0.21 },
    { symbol: 'DIA', name: 'Dow Jones', price: 43789.50, change: -89.12, changePercent: -0.20 },
    { symbol: 'VIX', name: 'VIX', price: 13.45, change: 0.34, changePercent: 2.59 },
  ];

  const watchlist = [
    { symbol: 'TSLA', name: 'Tesla, Inc.', price: 475.19, change: -2.10 },
    { symbol: 'NVDA', name: 'NVIDIA Corp', price: 134.50, change: 1.23 },
    { symbol: 'META', name: 'Meta Platforms', price: 612.30, change: -0.64 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 198.45, change: -0.22 },
  ];

  const suggestions = [
    'What are the latest US market movements?',
    'Bitcoin price analysis and predictions',
    'Best dividend stocks for 2025',
    'Swiss tax optimization strategies',
    'Impact of Fed rate decisions',
    'Crypto regulatory updates',
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

  const tabs = ['Markets', 'Crypto', 'Earnings', 'Predictions', 'Watchlist'];

  return (
    <div className="flex min-h-screen bg-[#FEFEFB]">
      <SimpleSidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      
      <div className="flex-1 flex">
        {/* Main Content */}
        <div className="flex-1 max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="space-y-6">
              {/* Title Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2A8C86]/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-[#2A8C86]" />
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground">Finance</h1>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2 text-muted-foreground">
                    <Bell className="w-4 h-4" />
                    Price Alert
                  </Button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search for stocks, crypto, and more..."
                  className="pl-12 pr-12 h-12 text-base rounded-xl border-border/50 bg-white shadow-sm"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  {isSearching ? (
                    <Loader2 className="w-5 h-5 text-[#2A8C86] animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5 text-[#2A8C86]" />
                  )}
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 border-b border-border/30">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab.toLowerCase())}
                    className={cn(
                      "px-4 py-2.5 text-sm font-medium transition-colors relative",
                      activeTab === tab.toLowerCase()
                        ? "text-[#2A8C86]"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                    {activeTab === tab.toLowerCase() && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2A8C86]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Market Tickers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {marketData.map((ticker) => (
                <Card key={ticker.symbol} className="p-4 bg-white border-border/40 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{ticker.name}</span>
                    <span className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded",
                      ticker.changePercent >= 0 
                        ? "bg-green-100 text-green-700" 
                        : "bg-red-100 text-red-700"
                    )}>
                      {ticker.changePercent >= 0 ? '↗' : '↘'} {Math.abs(ticker.changePercent).toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-xl font-semibold text-foreground">
                    {ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <p className={cn(
                    "text-sm",
                    ticker.change >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(2)}
                  </p>
                </Card>
              ))}
            </div>

            {/* Search Result */}
            {result && (
              <Card className="p-6 bg-white border-border/40">
                <div className="prose prose-sm max-w-none text-foreground">
                  {result.content.split('\n').map((paragraph, i) => (
                    paragraph.trim() && (
                      <p key={i} className="mb-3 text-foreground/90 leading-relaxed">
                        {paragraph}
                      </p>
                    )
                  ))}
                </div>
                
                {result.citations && result.citations.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-border/30">
                    <div className="flex flex-wrap gap-2">
                      {result.citations.map((citation) => (
                        <a
                          key={citation.index}
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted/50 hover:bg-muted rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <span className="text-[#2A8C86] font-medium">[{citation.index}]</span>
                          <span className="truncate max-w-[120px]">
                            {citation.domain}
                          </span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Suggestions */}
            {!result && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Get started</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setQuery(suggestion);
                        setTimeout(handleSearch, 100);
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-border/40 text-left text-sm transition-all text-foreground"
                    >
                      <ArrowRight className="w-4 h-4 text-[#2A8C86] flex-shrink-0" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="hidden lg:block w-80 border-l border-border/30 bg-white/50 p-6">
          {/* Date & Sentiment */}
          <div className="mb-6">
            <p className="text-xs text-muted-foreground mb-3">Dec 28, 2025, EST • Pre-market</p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-0.5">
                {[...Array(8)].map((_, i) => (
                  <div 
                    key={i}
                    className="w-2 h-8 rounded-full bg-[#2A8C86]" 
                    style={{ opacity: 0.3 + (i * 0.1) }}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">Bullish Sentiment</span>
            </div>
          </div>

          {/* Watchlist */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-foreground">Watchlist</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Star className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {watchlist.map((item) => (
                <div 
                  key={item.symbol}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {item.symbol.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">${item.price.toFixed(2)}</p>
                    <p className={cn(
                      "text-xs",
                      item.change >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {item.change >= 0 ? '↗' : '↘'} {Math.abs(item.change).toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prediction Markets */}
          <div>
            <h3 className="font-medium text-foreground mb-4">Prediction Markets</h3>
            <Card className="p-4 bg-white border-border/40">
              <p className="text-sm font-medium text-foreground mb-3">Fed decision in January?</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">No change</span>
                  <span className="font-medium text-foreground">86.0% <span className="text-green-600">↗2.0%</span></span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">25 bps decrease</span>
                  <span className="font-medium text-foreground">13.0% <span className="text-red-600">↘1.0%</span></span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">50+ bps decrease</span>
                  <span className="font-medium text-foreground">1.0%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                $72M vol. • via Polymarket
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
