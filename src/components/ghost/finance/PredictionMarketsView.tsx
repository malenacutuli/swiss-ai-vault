import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PredictionMarket {
  question: string;
  category: string;
  volume: string;
  options: { label: string; probability: number }[];
  source: string;
}

const predictionMarkets: PredictionMarket[] = [
  {
    question: 'Will the Fed cut rates in January 2025?',
    category: 'Economics',
    volume: '$72M',
    options: [
      { label: 'No change', probability: 86 },
      { label: '25 bps cut', probability: 13 },
      { label: '50+ bps cut', probability: 1 },
    ],
    source: 'Polymarket',
  },
  {
    question: 'Will Bitcoin reach $100K in Q1 2025?',
    category: 'Crypto',
    volume: '$45M',
    options: [
      { label: 'Yes', probability: 42 },
      { label: 'No', probability: 58 },
    ],
    source: 'Polymarket',
  },
  {
    question: 'Will S&P 500 close above 6,200 by end of January?',
    category: 'Markets',
    volume: '$28M',
    options: [
      { label: 'Yes', probability: 35 },
      { label: 'No', probability: 65 },
    ],
    source: 'Kalshi',
  },
  {
    question: 'Will NVIDIA beat Q4 earnings estimates?',
    category: 'Earnings',
    volume: '$18M',
    options: [
      { label: 'Beat', probability: 72 },
      { label: 'Miss', probability: 28 },
    ],
    source: 'Polymarket',
  },
];

export function PredictionMarketsView() {
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
                {market.category}
              </span>
              <h4 className="text-base font-medium text-slate-900 mt-2">{market.question}</h4>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Volume</p>
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
    </div>
  );
}
