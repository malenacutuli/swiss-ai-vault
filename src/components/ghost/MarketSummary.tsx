import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';

export function MarketSummary() {
  const { t } = useTranslation();

  const articleKeys = [
    'ghost.modules.finance.marketSummary.articles.bitcoin',
    'ghost.modules.finance.marketSummary.articles.oil',
    'ghost.modules.finance.marketSummary.articles.corporate',
    'ghost.modules.finance.marketSummary.articles.metals',
  ];

  const timeKeys = [
    'ghost.modules.finance.marketSummary.time.2h',
    'ghost.modules.finance.marketSummary.time.3h',
    'ghost.modules.finance.marketSummary.time.4h',
    'ghost.modules.finance.marketSummary.time.5h',
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">
          {t('ghost.modules.finance.marketSummary.title')}
        </h3>
        <span className="text-xs text-slate-400">
          {t('ghost.modules.finance.marketSummary.updated')}
        </span>
      </div>
      
      <div className="space-y-3">
        {articleKeys.map((key, i) => (
          <Card 
            key={i}
            className="p-4 bg-white border-slate-200/60 hover:shadow-sm transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-slate-900 leading-tight mb-1.5">
                  {t(`${key}.title`)}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {t(`${key}.summary`)}
                </p>
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">
                {t(timeKeys[i])}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
