import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { MarketSparkline } from '../MarketSparkline';
import { cn } from '@/lib/utils';

interface CryptoAsset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: string;
}

const cryptoData: CryptoAsset[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 94235.50, change: -1245.30, changePercent: -1.30, marketCap: '$1.87T' },
  { symbol: 'ETH', name: 'Ethereum', price: 3412.80, change: 45.20, changePercent: 1.34, marketCap: '$410B' },
  { symbol: 'SOL', name: 'Solana', price: 189.45, change: 8.90, changePercent: 4.93, marketCap: '$89B' },
  { symbol: 'BNB', name: 'BNB', price: 712.30, change: -12.50, changePercent: -1.73, marketCap: '$106B' },
  { symbol: 'XRP', name: 'XRP', price: 2.34, change: 0.12, changePercent: 5.41, marketCap: '$134B' },
  { symbol: 'ADA', name: 'Cardano', price: 0.98, change: 0.04, changePercent: 4.26, marketCap: '$35B' },
];

export function CryptoMarketView() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Crypto Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cryptoData.map((crypto) => (
          <Card 
            key={crypto.symbol} 
            className="p-4 bg-white border-slate-200/60 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600">
                  {crypto.symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{crypto.name}</p>
                  <p className="text-xs text-slate-500">{crypto.symbol}</p>
                </div>
              </div>
              <span className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded",
                crypto.changePercent >= 0 
                  ? "bg-green-50 text-green-700" 
                  : "bg-red-50 text-red-700"
              )}>
                {crypto.changePercent >= 0 ? '↑' : '↓'} {Math.abs(crypto.changePercent).toFixed(2)}%
              </span>
            </div>
            
            {/* Sparkline */}
            <div className="my-2">
              <MarketSparkline changePercent={crypto.changePercent} />
            </div>
            
            <div className="flex items-end justify-between">
              <div className="text-xl font-semibold text-slate-900">
                ${crypto.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-500">
                {t('ghost.modules.finance.views.crypto.mcap')}: {crypto.marketCap}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Top Movers */}
      <div>
        <h3 className="text-sm font-medium text-slate-500 mb-3">
          {t('ghost.modules.finance.views.crypto.topMovers')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cryptoData.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 4).map((crypto) => (
            <div
              key={crypto.symbol}
              className="flex items-center justify-between p-3 bg-white border border-slate-200/60 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600">
                  {crypto.symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{crypto.name}</p>
                  <p className="text-xs text-slate-500">${crypto.price.toLocaleString()}</p>
                </div>
              </div>
              <span className={cn(
                "text-sm font-semibold",
                crypto.changePercent >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {crypto.changePercent >= 0 ? '+' : ''}{crypto.changePercent.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
