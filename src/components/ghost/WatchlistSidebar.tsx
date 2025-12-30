import { Plus, RefreshCw, AlertCircle } from '@/icons';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useFinanceData, WatchlistStock, PredictionMarket } from '@/hooks/useFinanceData';

interface WatchlistData {
  stocks: WatchlistStock[];
  sentiment: {
    label: string;
    value: number;
  };
  date: string;
  marketStatus: string;
}

interface PredictionsData {
  markets: PredictionMarket[];
}

export function WatchlistSidebar() {
  const { t } = useTranslation();
  const { data: watchlistData, isLoading: watchlistLoading, error: watchlistError, refresh: refreshWatchlist } = useFinanceData<WatchlistData>('watchlist');
  const { data: predictionsData, isLoading: predictionsLoading, error: predictionsError, refresh: refreshPredictions } = useFinanceData<PredictionsData>('predictions');

  const stocks = watchlistData?.stocks || [];
  const sentiment = watchlistData?.sentiment || { label: 'Neutral', value: 5 };
  const dateInfo = watchlistData?.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const marketStatus = watchlistData?.marketStatus || 'Market';
  const predictions = predictionsData?.markets || [];

  return (
    <div className="w-80 border-l border-slate-200/60 bg-white/50 p-6 space-y-6">
      {/* Header */}
      <div className="space-y-3">
        {watchlistLoading ? (
          <>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-24" />
          </>
        ) : watchlistError ? (
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">{t('common.error')}</span>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400">{dateInfo} • {marketStatus}</p>
            <div className="flex items-center gap-2">
              {/* Sentiment bar - professional style */}
              <div className="flex -space-x-0.5">
                {[...Array(8)].map((_, i) => (
                  <div 
                    key={i}
                    className={cn(
                      "w-1.5 h-6 rounded-full",
                      i < sentiment.value ? "bg-[#2A8C86]" : "bg-slate-200"
                    )}
                    style={{ opacity: i < sentiment.value ? (0.2 + (i * 0.1)) : 0.3 }}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-500">{sentiment.label}</span>
            </div>
          </>
        )}
      </div>
      
      {/* Watchlist */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">{t('ghost.modules.finance.watchlist', 'Watchlist')}</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" onClick={refreshWatchlist}>
              <RefreshCw className={cn("w-3.5 h-3.5", watchlistLoading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-1">
          {watchlistLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-2.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-10" />
                </div>
              </div>
            ))
          ) : watchlistError ? (
            <Card className="p-4 text-center">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500">{watchlistError}</p>
              <Button variant="outline" size="sm" onClick={refreshWatchlist} className="mt-2 text-xs">
                {t('common.retry')}
              </Button>
            </Card>
          ) : stocks.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">{t('ghost.modules.finance.noWatchlistItems', 'No items in watchlist')}</p>
          ) : (
            stocks.map((item) => (
              <div 
                key={item.symbol}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Professional monogram - no logos */}
                  <span className="text-sm font-semibold text-swiss-teal">
                    {item.symbol.substring(0, 2)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-700 leading-tight">{item.name}</p>
                    <p className="text-[11px] text-slate-400">{item.symbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">
                    ${item.price.toFixed(2)}
                  </p>
                  <p className={cn(
                    "text-[11px] font-medium",
                    item.changePercent >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Prediction Markets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">{t('ghost.modules.finance.tabs.predictions', 'Prediction Markets')}</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" onClick={refreshPredictions}>
            <RefreshCw className={cn("w-3.5 h-3.5", predictionsLoading && "animate-spin")} />
          </Button>
        </div>
        
        {predictionsLoading ? (
          <Card className="p-4 bg-white border-slate-200/60 space-y-3">
            <Skeleton className="h-4 w-40" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-3 w-24" />
          </Card>
        ) : predictionsError ? (
          <Card className="p-4 bg-white border-slate-200/60 text-center">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-xs text-slate-500">{predictionsError}</p>
            <Button variant="outline" size="sm" onClick={refreshPredictions} className="mt-2 text-xs">
              {t('common.retry')}
            </Button>
          </Card>
        ) : predictions.length === 0 ? (
          <Card className="p-4 bg-white border-slate-200/60">
            <p className="text-xs text-slate-400 text-center">{t('ghost.modules.finance.noPredictions', 'No prediction markets available')}</p>
          </Card>
        ) : (
          predictions.slice(0, 1).map((prediction, idx) => (
            <Card key={idx} className="p-4 bg-white border-slate-200/60">
              <p className="text-sm font-medium text-slate-900 mb-3">{prediction.question}</p>
              <div className="space-y-2">
                {prediction.options.map((option, optIdx) => (
                  <div key={optIdx} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{option.label}</span>
                    <span className="font-medium text-slate-900">{option.probability.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                {prediction.volume} • {prediction.source}
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
