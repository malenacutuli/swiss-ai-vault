import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Filter, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  marketCap: string;
  pe: number;
  dividend: number;
  sectorKey: string;
}

const stocks: Stock[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 190.53, change: 1.02, marketCap: '$2.95T', pe: 28.4, dividend: 0.52, sectorKey: 'technology' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 378.91, change: -0.34, marketCap: '$2.81T', pe: 35.2, dividend: 0.75, sectorKey: 'technology' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 134.50, change: 2.15, marketCap: '$3.31T', pe: 62.8, dividend: 0.04, sectorKey: 'technology' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', price: 145.20, change: -0.89, marketCap: '$349B', pe: 14.2, dividend: 3.12, sectorKey: 'healthcare' },
  { symbol: 'JPM', name: 'JPMorgan Chase', price: 198.75, change: 1.45, marketCap: '$570B', pe: 11.8, dividend: 2.35, sectorKey: 'finance' },
  { symbol: 'V', name: 'Visa Inc.', price: 289.40, change: 0.78, marketCap: '$571B', pe: 29.6, dividend: 0.72, sectorKey: 'finance' },
];

const sectorKeys = ['all', 'technology', 'healthcare', 'finance', 'consumer', 'energy'];
const sortOptionKeys = ['marketCap', 'price', 'change', 'pe', 'dividend'];

export function StockScreenerView() {
  const { t } = useTranslation();
  const [selectedSector, setSelectedSector] = useState('all');
  const [sortBy, setSortBy] = useState('marketCap');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStocks = stocks.filter(stock => {
    const matchesSector = selectedSector === 'all' || stock.sectorKey === selectedSector;
    const matchesSearch = stock.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          stock.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSector && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Input
            placeholder={t('ghost.modules.finance.views.screener.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 bg-white border-slate-200"
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 h-9 border-slate-200">
              <Filter className="w-4 h-4" />
              {t(`ghost.modules.finance.views.screener.sectors.${selectedSector}`)}
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {sectorKeys.map((sector) => (
              <DropdownMenuItem key={sector} onClick={() => setSelectedSector(sector)}>
                {t(`ghost.modules.finance.views.screener.sectors.${sector}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 h-9 border-slate-200">
              {t('ghost.modules.finance.views.screener.sortBy')}: {t(`ghost.modules.finance.views.screener.sortOptions.${sortBy}`)}
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {sortOptionKeys.map((option) => (
              <DropdownMenuItem key={option} onClick={() => setSortBy(option)}>
                {t(`ghost.modules.finance.views.screener.sortOptions.${option}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Results Table */}
      <Card className="overflow-hidden bg-white border-slate-200/60">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left p-4 text-xs font-medium text-slate-500">
                  {t('ghost.modules.finance.views.screener.columns.symbol')}
                </th>
                <th className="text-left p-4 text-xs font-medium text-slate-500">
                  {t('ghost.modules.finance.views.screener.columns.name')}
                </th>
                <th className="text-right p-4 text-xs font-medium text-slate-500">
                  {t('ghost.modules.finance.views.screener.columns.price')}
                </th>
                <th className="text-right p-4 text-xs font-medium text-slate-500">
                  {t('ghost.modules.finance.views.screener.columns.change')}
                </th>
                <th className="text-right p-4 text-xs font-medium text-slate-500">
                  {t('ghost.modules.finance.views.screener.columns.marketCap')}
                </th>
                <th className="text-right p-4 text-xs font-medium text-slate-500">
                  {t('ghost.modules.finance.views.screener.columns.pe')}
                </th>
                <th className="text-right p-4 text-xs font-medium text-slate-500">
                  {t('ghost.modules.finance.views.screener.columns.dividend')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((stock) => (
                <tr
                  key={stock.symbol}
                  className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
                >
                  <td className="p-4">
                    <span className="text-sm font-semibold text-slate-900">{stock.symbol}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-slate-600">{stock.name}</span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-sm font-medium text-slate-900">
                      ${stock.price.toFixed(2)}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className={cn(
                      "text-sm font-medium",
                      stock.change >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-sm text-slate-600">{stock.marketCap}</span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-sm text-slate-600">{stock.pe.toFixed(1)}</span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-sm text-slate-600">{stock.dividend.toFixed(2)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
