import { Card } from '@/components/ui/card';
import { MarketSparkline } from '@/components/ghost/MarketSparkline';
import { cn } from '@/lib/utils';

const menaMarkets = [
  { symbol: 'TASI', name: 'Saudi Tadawul', price: 12234.50, change: 89.30, changePercent: 0.73 },
  { symbol: 'ADX', name: 'Abu Dhabi ADX', price: 9012.45, change: 45.80, changePercent: 0.51 },
  { symbol: 'DFM', name: 'Dubai DFM', price: 4234.20, change: -18.45, changePercent: -0.43 },
  { symbol: 'QSE', name: 'Qatar QSE', price: 10543.30, change: 62.10, changePercent: 0.59 },
];

export function MENAMarketsView() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {menaMarkets.map((ticker) => (
          <Card key={ticker.symbol} className="p-4 bg-white border-slate-200/60 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">{ticker.name}</span>
              <span className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded",
                ticker.changePercent >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              )}>
                {ticker.changePercent >= 0 ? '↑' : '↓'} {Math.abs(ticker.changePercent).toFixed(2)}%
              </span>
            </div>
            <div className="my-2">
              <MarketSparkline changePercent={ticker.changePercent} />
            </div>
            <div className="flex items-end justify-between">
              <div className="text-xl font-semibold text-slate-900">
                {ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className={cn("text-sm font-medium", ticker.change >= 0 ? "text-green-600" : "text-red-600")}>
                {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(2)}
              </p>
            </div>
          </Card>
        ))}
      </div>
      
      <Card className="p-6 bg-white border-slate-200/60">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">MENA Market Summary</h3>
        <p className="text-slate-600 text-sm leading-relaxed">
          Gulf markets benefit from elevated oil prices and economic diversification efforts. Saudi Arabia's 
          Tadawul gains on Vision 2030 infrastructure spending. UAE markets show resilience with Abu Dhabi 
          outperforming Dubai. Qatar remains stable on LNG export strength.
        </p>
      </Card>
    </div>
  );
}
