import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, AlertCircle } from '@/icons';
import { MarketSparkline } from '../MarketSparkline';
import { useFinanceData, CryptoAsset } from '@/hooks/useFinanceData';
import { cn } from '@/lib/utils';

export function CryptoMarketView() {
  const { t } = useTranslation();
  const { data, isLoading, error, refresh, lastUpdated } = useFinanceData<CryptoAsset[]>('crypto');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4 bg-white border-slate-200/60">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-16 mb-1" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
                <Skeleton className="h-5 w-12" />
              </div>
              <Skeleton className="h-12 w-full my-2" />
              <Skeleton className="h-6 w-24" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 bg-white border-slate-200/60 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h4 className="text-base font-medium text-slate-900 mb-1">
          {t('ghost.modules.finance.views.crypto.errorTitle')}
        </h4>
        <p className="text-sm text-slate-500 mb-4">{error}</p>
        <Button variant="outline" onClick={refresh} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          {t('common.retry')}
        </Button>
      </Card>
    );
  }

  const cryptoData = data || [];

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {lastUpdated && t('ghost.modules.finance.views.crypto.lastUpdated', { 
            time: new Date(lastUpdated).toLocaleTimeString() 
          })}
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} className="gap-2 h-8">
          <RefreshCw className="w-3.5 h-3.5" />
          {t('common.refresh')}
        </Button>
      </div>

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
      {cryptoData.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-500 mb-3">
            {t('ghost.modules.finance.views.crypto.topMovers')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...cryptoData]
              .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
              .slice(0, 4)
              .map((crypto) => (
                <div
                  key={`mover-${crypto.symbol}`}
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
      )}
    </div>
  );
}
