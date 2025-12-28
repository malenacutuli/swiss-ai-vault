import { Card } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';

interface EarningsEvent {
  company: string;
  symbol: string;
  date: string;
  time: 'Before Open' | 'After Close';
  estimate: string;
  actual?: string;
}

const upcomingEarnings: EarningsEvent[] = [
  { company: 'Apple Inc.', symbol: 'AAPL', date: 'Jan 30', time: 'After Close', estimate: '$2.35' },
  { company: 'Microsoft Corp.', symbol: 'MSFT', date: 'Jan 28', time: 'After Close', estimate: '$3.12' },
  { company: 'Alphabet Inc.', symbol: 'GOOGL', date: 'Feb 4', time: 'After Close', estimate: '$2.01' },
  { company: 'Amazon.com Inc.', symbol: 'AMZN', date: 'Feb 6', time: 'After Close', estimate: '$1.48' },
  { company: 'Meta Platforms', symbol: 'META', date: 'Jan 29', time: 'After Close', estimate: '$6.72' },
  { company: 'NVIDIA Corp.', symbol: 'NVDA', date: 'Feb 26', time: 'After Close', estimate: '$0.84' },
];

const recentEarnings: EarningsEvent[] = [
  { company: 'Tesla Inc.', symbol: 'TSLA', date: 'Jan 23', time: 'After Close', estimate: '$0.73', actual: '$0.71' },
  { company: 'Netflix Inc.', symbol: 'NFLX', date: 'Jan 21', time: 'After Close', estimate: '$4.18', actual: '$4.27' },
];

export function EarningsCalendarView() {
  return (
    <div className="space-y-6">
      {/* Upcoming Earnings */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-medium text-slate-900">Upcoming Earnings</h3>
        </div>
        
        <div className="space-y-2">
          {upcomingEarnings.map((event) => (
            <Card
              key={event.symbol}
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
                  <p className="text-xs text-slate-500">{event.time}</p>
                </div>
                
                <div className="text-right">
                  <p className="text-xs text-slate-500">EPS Est.</p>
                  <p className="text-sm font-semibold text-slate-900">{event.estimate}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Earnings */}
      <div>
        <h3 className="text-sm font-medium text-slate-900 mb-4">Recent Earnings</h3>
        
        <div className="space-y-2">
          {recentEarnings.map((event) => {
            const beat = event.actual && parseFloat(event.actual.replace('$', '')) > parseFloat(event.estimate.replace('$', ''));
            
            return (
              <Card
                key={event.symbol}
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
                      <p className="text-xs text-slate-500">Estimate</p>
                      <p className="text-sm text-slate-600">{event.estimate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Actual</p>
                      <p className={`text-sm font-semibold ${beat ? 'text-green-600' : 'text-red-600'}`}>
                        {event.actual}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${beat ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {beat ? 'Beat' : 'Miss'}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
