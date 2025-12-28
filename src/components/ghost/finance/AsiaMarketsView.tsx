import { Card } from '@/components/ui/card';
import { MarketSparkline } from '@/components/ghost/MarketSparkline';
import { cn } from '@/lib/utils';

const asiaMarkets = [
  { symbol: 'N225', name: 'Japan Nikkei', price: 39234.50, change: 456.30, changePercent: 1.18 },
  { symbol: 'HSI', name: 'Hong Kong Hang Seng', price: 19892.45, change: -234.80, changePercent: -1.17 },
  { symbol: 'SSEC', name: 'Shanghai Composite', price: 3012.30, change: 18.45, changePercent: 0.62 },
  { symbol: 'KOSPI', name: 'South Korea KOSPI', price: 2543.20, change: 32.10, changePercent: 1.28 },
];

export function AsiaMarketsView() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {asiaMarkets.map((ticker) => (
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
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Asia Market Summary</h3>
        <p className="text-slate-600 text-sm leading-relaxed">
          Asian markets show mixed performance. Japan's Nikkei hits new highs on yen weakness benefiting exporters. 
          Hong Kong faces pressure from property sector concerns while mainland China stabilizes on policy support. 
          South Korea gains on semiconductor strength.
        </p>
      </Card>
    </div>
  );
}
