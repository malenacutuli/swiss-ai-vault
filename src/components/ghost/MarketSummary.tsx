import { Card } from '@/components/ui/card';

interface Article {
  title: string;
  summary: string;
  time: string;
}

export function MarketSummary() {
  const articles: Article[] = [
    {
      title: "Bitcoin Tumbles Below $88,000 Amid Year-End Selloff",
      summary: "Bitcoin is trading at $87,775, down 0.04%, well below its October high. Hawkish Bank of Japan comments triggered a sharp selloff with digital asset treasury stocks leading the decline.",
      time: "2h ago"
    },
    {
      title: "Crude Oil Plunges 2.76% on Oversupply Concerns",
      summary: "Oil prices dropped to $56.74, marking the lowest level since May and heading for the biggest annual decline in seven years as OPEC+ members ramped up production.",
      time: "3h ago"
    },
    {
      title: "Corporate Bitcoin Holdings Face Liquidity Pressure",
      summary: "Strategy established a $1.44 billion cash reserve and slashed profit targets as its stock fell below its bitcoin holdings' value.",
      time: "4h ago"
    },
    {
      title: "Precious Metals Rally to Record Highs",
      summary: "Gold and silver reached unprecedented highs amid a parabolic rally, showing strong correlation with momentum stocks and benefiting from AI manufacturing applications.",
      time: "5h ago"
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Market Summary</h3>
        <span className="text-xs text-slate-400">Updated 12 min ago</span>
      </div>
      
      <div className="space-y-3">
        {articles.map((article, i) => (
          <Card 
            key={i}
            className="p-4 bg-white border-slate-200/60 hover:shadow-sm transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-slate-900 leading-tight mb-1.5">
                  {article.title}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {article.summary}
                </p>
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">
                {article.time}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
