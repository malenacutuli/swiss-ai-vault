import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, RefreshCw, AlertCircle } from 'lucide-react';
import { useFinanceData, EarningsData } from '@/hooks/useFinanceData';
import { cn } from '@/lib/utils';

export function EarningsCalendarView() {
  const { t } = useTranslation();
  const { data, isLoading, error, refresh, lastUpdated } = useFinanceData<EarningsData>('earnings');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-4 h-4" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 bg-white border-slate-200/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 bg-white border-slate-200/60 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h4 className="text-base font-medium text-slate-900 mb-1">
          {t('ghost.modules.finance.views.earnings.errorTitle')}
        </h4>
        <p className="text-sm text-slate-500 mb-4">{error}</p>
        <Button variant="outline" onClick={refresh} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          {t('common.retry')}
        </Button>
      </Card>
    );
  }

  const upcoming = data?.upcoming || [];
  const recent = data?.recent || [];

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {lastUpdated && t('ghost.modules.finance.views.earnings.lastUpdated', { 
            time: new Date(lastUpdated).toLocaleTimeString() 
          })}
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} className="gap-2 h-8">
          <RefreshCw className="w-3.5 h-3.5" />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Upcoming Earnings */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-medium text-slate-900">
            {t('ghost.modules.finance.views.earnings.upcoming')}
          </h3>
        </div>
        
        <div className="space-y-2">
          {upcoming.map((event, index) => (
            <Card
              key={`${event.symbol}-${index}`}
              className="p-4 bg-white border-slate-200/60 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                    {event.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{event.company}</p>
                    <p className="text-xs text-slate-500">{event.symbol}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{event.date}</p>
                  <p className="text-xs text-slate-500">
                    {event.time === 'afterClose' 
                      ? t('ghost.modules.finance.views.earnings.afterClose')
                      : t('ghost.modules.finance.views.earnings.beforeOpen')}
                  </p>
                </div>
                
                <div className="text-right">
                  <p className="text-xs text-slate-500">
                    {t('ghost.modules.finance.views.earnings.epsEstimate')}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{event.estimate}</p>
                </div>
              </div>
            </Card>
          ))}
          {upcoming.length === 0 && (
            <p className="text-sm text-slate-500 italic py-4">
              {t('ghost.modules.finance.views.earnings.noUpcoming')}
            </p>
          )}
        </div>
      </div>

      {/* Recent Earnings */}
      {recent.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-900 mb-4">
            {t('ghost.modules.finance.views.earnings.recent')}
          </h3>
          
          <div className="space-y-2">
            {recent.map((event, index) => {
              const beat = event.actual && parseFloat(event.actual.replace('$', '')) > parseFloat(event.estimate.replace('$', ''));
              
              return (
                <Card
                  key={`${event.symbol}-recent-${index}`}
                  className="p-4 bg-white border-slate-200/60"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {event.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{event.company}</p>
                        <p className="text-xs text-slate-500">{event.symbol} • {event.date}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          {t('ghost.modules.finance.views.earnings.estimate')}
                        </p>
                        <p className="text-sm text-slate-600">{event.estimate}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          {t('ghost.modules.finance.views.earnings.actual')}
                        </p>
                        <p className={cn(
                          "text-sm font-semibold",
                          beat ? 'text-green-600' : 'text-red-600'
                        )}>
                          {event.actual}
                        </p>
                      </div>
                      <span className={cn(
                        "text-xs font-medium px-2 py-1 rounded",
                        beat ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      )}>
                        {beat 
                          ? t('ghost.modules.finance.views.earnings.beat') 
                          : t('ghost.modules.finance.views.earnings.miss')}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
