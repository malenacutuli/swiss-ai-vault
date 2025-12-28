import { Card } from '@/components/ui/card';
import { MarketSparkline } from '@/components/ghost/MarketSparkline';
import { cn } from '@/lib/utils';

const latamMarkets = [
  { symbol: 'BVSP', name: 'Brazil Bovespa', price: 127543.20, change: 1245.30, changePercent: 0.99 },
  { symbol: 'IPC', name: 'Mexico IPC', price: 52892.45, change: -312.80, changePercent: -0.59 },
  { symbol: 'MERV', name: 'Argentina Merval', price: 1892456.30, change: 45678.90, changePercent: 2.47 },
  { symbol: 'IPSA', name: 'Chile IPSA', price: 6234.50, change: 28.45, changePercent: 0.46 },
];

export function LatamMarketsView() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {latamMarkets.map((ticker) => (
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
                {ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className={cn("text-sm font-medium", ticker.change >= 0 ? "text-green-600" : "text-red-600")}>
                {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(2)}
              </p>
            </div>
          </Card>
        ))}
      </div>
      
      <Card className="p-6 bg-white border-slate-200/60">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">LatAm Market Summary</h3>
        <p className="text-slate-600 text-sm leading-relaxed">
          Latin American markets show divergent trends. Argentina's Merval surges on political reform optimism. 
          Brazil's Bovespa gains on commodity exports while Mexico faces pressure from peso volatility 
          and trade policy uncertainty.
        </p>
      </Card>
    </div>
  );
}
