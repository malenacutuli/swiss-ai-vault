import { Card } from '@/components/ui/card';
import { MarketSparkline } from '@/components/ghost/MarketSparkline';
import { cn } from '@/lib/utils';

const swissMarkets = [
  { symbol: 'SMI', name: 'Swiss Market Index', price: 11892.45, change: 78.30, changePercent: 0.66 },
  { symbol: 'NESN', name: 'Nestlé', price: 87.42, change: 0.85, changePercent: 0.98 },
  { symbol: 'NOVN', name: 'Novartis', price: 92.18, change: -0.42, changePercent: -0.45 },
  { symbol: 'UBSG', name: 'UBS Group', price: 28.45, change: 0.32, changePercent: 1.14 },
];

export function SwissMarketsView() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {swissMarkets.map((ticker) => (
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
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Swiss Market Summary</h3>
        <p className="text-slate-600 text-sm leading-relaxed">
          The SMI continues its steady climb with defensive stocks leading. UBS shows strength following 
          positive earnings outlook. Nestlé benefits from stable consumer demand while Novartis faces 
          pressure from patent expiration concerns.
        </p>
      </Card>
    </div>
  );
}
