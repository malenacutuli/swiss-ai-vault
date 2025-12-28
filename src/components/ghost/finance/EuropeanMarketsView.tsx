import { Card } from '@/components/ui/card';
import { MarketSparkline } from '@/components/ghost/MarketSparkline';
import { cn } from '@/lib/utils';

const europeanMarkets = [
  { symbol: 'DAX', name: 'Germany DAX', price: 20012.45, change: 125.30, changePercent: 0.63 },
  { symbol: 'CAC40', name: 'France CAC 40', price: 7543.20, change: -18.45, changePercent: -0.24 },
  { symbol: 'FTSE', name: 'UK FTSE 100', price: 8234.50, change: 45.12, changePercent: 0.55 },
  { symbol: 'STOXX50', name: 'Euro Stoxx 50', price: 4892.30, change: 32.80, changePercent: 0.67 },
];

export function EuropeanMarketsView() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {europeanMarkets.map((ticker) => (
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
        <h3 className="text-lg font-semibold text-slate-900 mb-4">European Market Summary</h3>
        <p className="text-slate-600 text-sm leading-relaxed">
          European markets are showing mixed performance today. The German DAX leads with gains driven by 
          strong automotive sector performance. UK's FTSE 100 benefits from commodity strength while 
          French markets face pressure from banking sector concerns.
        </p>
      </Card>
    </div>
  );
}
