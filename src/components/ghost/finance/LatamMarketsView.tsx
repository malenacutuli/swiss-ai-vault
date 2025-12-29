import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, AlertCircle } from '@/icons';
import { MarketSparkline } from '@/components/ghost/MarketSparkline';
import { useFinanceData, RegionalMarketData } from '@/hooks/useFinanceData';
import { cn } from '@/lib/utils';

export function LatamMarketsView() {
  const { t } = useTranslation();
  const { data, isLoading, error, refresh } = useFinanceData<RegionalMarketData>('markets', 'latam');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 bg-white border-slate-200/60">
              <Skeleton className="h-4 w-20 mb-2" />
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
        <p className="text-sm text-slate-500 mb-4">{error}</p>
        <Button variant="outline" onClick={refresh} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          {t('common.retry')}
        </Button>
      </Card>
    );
  }

  const markets = data?.markets || [];
  const summary = data?.summary || '';

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={refresh} className="gap-2 h-8">
          <RefreshCw className="w-3.5 h-3.5" />
          {t('common.refresh')}
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {markets.map((ticker) => (
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
      
      {summary && (
        <Card className="p-6 bg-white border-slate-200/60">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">{t('ghost.modules.finance.views.markets.summary')}</h3>
          <p className="text-slate-600 text-sm leading-relaxed">{summary}</p>
        </Card>
      )}
    </div>
  );
}
