import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarketSparkline } from '../MarketSparkline';

interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  alertPrice?: number;
}

const watchlistItems: WatchlistItem[] = [
  { symbol: 'TSLA', name: 'Tesla, Inc.', price: 475.19, change: -10.23, changePercent: -2.10, alertPrice: 450 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 134.50, change: 1.65, changePercent: 1.23 },
  { symbol: 'META', name: 'Meta Platforms, Inc.', price: 612.30, change: -3.92, changePercent: -0.64 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 198.45, change: -0.44, changePercent: -0.22 },
  { symbol: 'AAPL', name: 'Apple Inc.', price: 190.53, change: 1.94, changePercent: 1.02 },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', price: 224.78, change: 3.12, changePercent: 1.41 },
];

export function WatchlistView() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-900">Your Watchlist</h3>
        <Button variant="outline" size="sm" className="gap-2 h-8 border-slate-200">
          <Plus className="w-3.5 h-3.5" />
          Add Stock
        </Button>
      </div>

      {/* Watchlist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {watchlistItems.map((item) => (
          <Card
            key={item.symbol}
            className="p-4 bg-white border-slate-200/60 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                  {item.symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.symbol}</p>
                </div>
              </div>
              <button className="text-slate-400 hover:text-yellow-500 transition-colors">
                <Star className="w-4 h-4" />
              </button>
            </div>
            
            {/* Sparkline */}
            <div className="my-3">
              <MarketSparkline changePercent={item.changePercent} />
            </div>
            
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xl font-semibold text-slate-900">
                  ${item.price.toFixed(2)}
                </p>
                <div className="flex items-center gap-1">
                  {item.changePercent >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-600" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-600" />
                  )}
                  <span className={cn(
                    "text-sm font-medium",
                    item.changePercent >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
              
              {item.alertPrice && (
                <div className="text-right">
                  <p className="text-xs text-slate-500">Alert at</p>
                  <p className="text-sm font-medium text-slate-700">${item.alertPrice}</p>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {watchlistItems.length === 0 && (
        <Card className="p-8 bg-white border-slate-200/60 text-center">
          <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-medium text-slate-900 mb-1">No stocks in your watchlist</h4>
          <p className="text-sm text-slate-500 mb-4">Add stocks to track their performance</p>
          <Button variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Your First Stock
          </Button>
        </Card>
      )}
    </div>
  );
}
