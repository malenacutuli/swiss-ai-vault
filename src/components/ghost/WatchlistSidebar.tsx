import { Plus, RefreshCw } from '@/icons';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
}

export function WatchlistSidebar() {
  const watchlist: WatchlistItem[] = [
    { symbol: 'TSLA', name: 'Tesla, Inc.', price: 475.19, change: -2.10 },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 134.50, change: 1.23 },
    { symbol: 'META', name: 'Meta Platforms, Inc.', price: 612.30, change: -0.64 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 198.45, change: -0.22 },
    { symbol: 'AAPL', name: 'Apple Inc.', price: 190.53, change: 1.02 },
  ];

  return (
    <div className="w-80 border-l border-slate-200/60 bg-white/50 p-6 space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <p className="text-xs text-slate-400">Dec 28, 2025 • Pre-market</p>
        <div className="flex items-center gap-2">
          {/* Sentiment bar - professional style */}
          <div className="flex -space-x-0.5">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i}
                className="w-1.5 h-6 rounded-full bg-[#2A8C86]" 
                style={{ opacity: 0.2 + (i * 0.1) }}
              />
            ))}
          </div>
          <span className="text-xs text-slate-500">Bullish</span>
        </div>
      </div>
      
      {/* Watchlist */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Watchlist</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="space-y-1">
          {watchlist.map((item) => (
            <div 
              key={item.symbol}
              className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Professional monogram - no logos */}
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-slate-600">
                    {item.symbol.substring(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 leading-tight">{item.name}</p>
                  <p className="text-[11px] text-slate-400">{item.symbol}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">
                  ${item.price.toFixed(2)}
                </p>
                <p className={cn(
                  "text-[11px] font-medium",
                  item.change >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Prediction Markets */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Prediction Markets</h3>
        
        <Card className="p-4 bg-white border-slate-200/60">
          <p className="text-sm font-medium text-slate-900 mb-3">Fed decision in January?</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">No change</span>
              <span className="font-medium text-slate-900">86.0%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">25 bps decrease</span>
              <span className="font-medium text-slate-900">13.0%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">50+ bps decrease</span>
              <span className="font-medium text-slate-900">1.0%</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            $72M vol. • Polymarket
          </p>
        </Card>
      </div>
    </div>
  );
}
