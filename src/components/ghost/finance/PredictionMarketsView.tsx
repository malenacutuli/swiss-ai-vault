import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PredictionMarket {
  questionKey: string;
  categoryKey: string;
  volume: string;
  options: { labelKey: string; probability: number }[];
  source: string;
}

const predictionMarkets: PredictionMarket[] = [
  {
    questionKey: 'ghost.modules.finance.views.predictions.questions.fedRates',
    categoryKey: 'ghost.modules.finance.views.predictions.categories.economics',
    volume: '$72M',
    options: [
      { labelKey: 'ghost.modules.finance.views.predictions.options.noChange', probability: 86 },
      { labelKey: 'ghost.modules.finance.views.predictions.options.cut25', probability: 13 },
      { labelKey: 'ghost.modules.finance.views.predictions.options.cut50', probability: 1 },
    ],
    source: 'Polymarket',
  },
  {
    questionKey: 'ghost.modules.finance.views.predictions.questions.btc100k',
    categoryKey: 'ghost.modules.finance.views.predictions.categories.crypto',
    volume: '$45M',
    options: [
      { labelKey: 'common.yes', probability: 42 },
      { labelKey: 'common.no', probability: 58 },
    ],
    source: 'Polymarket',
  },
  {
    questionKey: 'ghost.modules.finance.views.predictions.questions.sp6200',
    categoryKey: 'ghost.modules.finance.views.predictions.categories.markets',
    volume: '$28M',
    options: [
      { labelKey: 'common.yes', probability: 35 },
      { labelKey: 'common.no', probability: 65 },
    ],
    source: 'Kalshi',
  },
  {
    questionKey: 'ghost.modules.finance.views.predictions.questions.nvidiaEarnings',
    categoryKey: 'ghost.modules.finance.views.predictions.categories.earnings',
    volume: '$18M',
    options: [
      { labelKey: 'ghost.modules.finance.views.earnings.beat', probability: 72 },
      { labelKey: 'ghost.modules.finance.views.earnings.miss', probability: 28 },
    ],
    source: 'Polymarket',
  },
];

export function PredictionMarketsView() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {predictionMarkets.map((market, index) => (
        <Card
          key={index}
          className="p-5 bg-white border-slate-200/60 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <span className="text-xs font-medium text-[#2A8C86] bg-[#2A8C86]/10 px-2 py-0.5 rounded-full">
                {t(market.categoryKey)}
              </span>
              <h4 className="text-base font-medium text-slate-900 mt-2">{t(market.questionKey)}</h4>
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
                    <span className="text-sm text-slate-700">{t(option.labelKey)}</span>
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
    </div>
  );
}
