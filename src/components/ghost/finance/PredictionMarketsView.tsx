import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle } from '@/icons';
import { useFinanceData, PredictionMarket } from '@/hooks/useFinanceData';
import { cn } from '@/lib/utils';

export function PredictionMarketsView() {
  const { t } = useTranslation();
  const { data, citations, isLoading, error, refresh, lastUpdated } = useFinanceData<PredictionMarket[]>('predictions');

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5 bg-white border-slate-200/60">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-6 w-3/4" />
              </div>
              <Skeleton className="h-10 w-16" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 bg-white border-slate-200/60 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h4 className="text-base font-medium text-slate-900 mb-1">
          {t('ghost.modules.finance.views.predictions.errorTitle')}
        </h4>
        <p className="text-sm text-slate-500 mb-4">{error}</p>
        <Button variant="outline" onClick={refresh} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          {t('common.retry')}
        </Button>
      </Card>
    );
  }

  const markets = data || [];

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {lastUpdated && t('ghost.modules.finance.views.predictions.lastUpdated', { 
            time: new Date(lastUpdated).toLocaleTimeString() 
          })}
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} className="gap-2 h-8">
          <RefreshCw className="w-3.5 h-3.5" />
          {t('common.refresh')}
        </Button>
      </div>

      {markets.map((market, index) => (
        <Card
          key={index}
          className="p-5 bg-white border-slate-200/60 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <span className="text-xs font-medium text-[#2A8C86] bg-[#2A8C86]/10 px-2 py-0.5 rounded-full">
                {market.category}
              </span>
              <h4 className="text-base font-medium text-slate-900 mt-2">{market.question}</h4>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">{t('ghost.modules.finance.views.predictions.volume')}</p>
              <p className="text-sm font-semibold text-slate-900">{market.volume}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {market.options.map((option, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">{option.label}</span>
                    <span className="text-sm font-semibold text-slate-900">{option.probability}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2A8C86] rounded-full transition-all"
                      style={{ width: `${option.probability}%` }}
                    />
                  </div>
                </div>
                {i === 0 && option.probability > 50 && (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                )}
                {i === 0 && option.probability < 50 && (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">{market.source}</p>
          </div>
        </Card>
      ))}

      {/* Citations */}
      {citations && citations.length > 0 && (
        <div className="pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-2">{t('ghost.modules.finance.views.predictions.sources')}</p>
          <div className="flex flex-wrap gap-2">
            {citations.slice(0, 3).map((citation, i) => (
              <a
                key={i}
                href={citation}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#2A8C86] hover:underline truncate max-w-xs"
              >
                {new URL(citation).hostname}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
