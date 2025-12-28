import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Star, TrendingUp, TrendingDown, RefreshCw, AlertCircle } from 'lucide-react';
import { MarketSparkline } from '../MarketSparkline';
import { useFinanceData, WatchlistStock } from '@/hooks/useFinanceData';
import { cn } from '@/lib/utils';

export function WatchlistView() {
  const { t } = useTranslation();
  const { data, isLoading, error, refresh, lastUpdated } = useFinanceData<WatchlistStock[]>('watchlist');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 bg-white border-slate-200/60">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
                <Skeleton className="w-4 h-4" />
              </div>
              <Skeleton className="h-12 w-full my-3" />
              <Skeleton className="h-6 w-20" />
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
          {t('ghost.modules.finance.views.watchlist.errorTitle')}
        </h4>
        <p className="text-sm text-slate-500 mb-4">{error}</p>
        <Button variant="outline" onClick={refresh} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          {t('common.retry')}
        </Button>
      </Card>
    );
  }

  const watchlistItems = data || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-medium text-slate-900">
            {t('ghost.modules.finance.views.watchlist.title')}
          </h3>
          <div className="text-xs text-slate-500">
            {lastUpdated && t('ghost.modules.finance.views.watchlist.lastUpdated', { 
              time: new Date(lastUpdated).toLocaleTimeString() 
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refresh} className="gap-2 h-8">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-8 border-slate-200">
            <Plus className="w-3.5 h-3.5" />
            {t('ghost.modules.finance.views.watchlist.addStock')}
          </Button>
        </div>
      </div>

      {/* Watchlist Grid */}
      {watchlistItems.length > 0 ? (
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
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card className="p-8 bg-white border-slate-200/60 text-center">
          <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-medium text-slate-900 mb-1">
            {t('ghost.modules.finance.views.watchlist.emptyTitle')}
          </h4>
          <p className="text-sm text-slate-500 mb-4">
            {t('ghost.modules.finance.views.watchlist.emptyDescription')}
          </p>
          <Button variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            {t('ghost.modules.finance.views.watchlist.addFirstStock')}
          </Button>
        </Card>
      )}
    </div>
  );
}
