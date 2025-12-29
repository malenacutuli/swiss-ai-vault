import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Filter, ChevronDown, RefreshCw, AlertCircle } from '@/icons';
import { useFinanceData, StockData } from '@/hooks/useFinanceData';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const sectorKeys = ['all', 'technology', 'healthcare', 'finance', 'consumer', 'energy'];
const sortOptionKeys = ['marketCap', 'price', 'change', 'pe', 'dividend'];

export function StockScreenerView() {
  const { t } = useTranslation();
  const { data, isLoading, error, refresh, lastUpdated } = useFinanceData<StockData[]>('screener');
  const [selectedSector, setSelectedSector] = useState('all');
  const [sortBy, setSortBy] = useState('marketCap');
  const [searchQuery, setSearchQuery] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Card className="overflow-hidden bg-white border-slate-200/60">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 bg-white border-slate-200/60 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h4 className="text-base font-medium text-slate-900 mb-1">
          {t('ghost.modules.finance.views.screener.errorTitle')}
        </h4>
        <p className="text-sm text-slate-500 mb-4">{error}</p>
        <Button variant="outline" onClick={refresh} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          {t('common.retry')}
        </Button>
      </Card>
    );
  }

  const stocks = data || [];
  
  const filteredStocks = stocks.filter(stock => {
    const matchesSector = selectedSector === 'all' || stock.sector === selectedSector;
    const matchesSearch = stock.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          stock.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSector && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
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

        <Button variant="ghost" size="sm" onClick={refresh} className="gap-2 h-9">
          <RefreshCw className="w-3.5 h-3.5" />
          {t('common.refresh')}
        </Button>

        <div className="text-xs text-slate-500">
          {lastUpdated && t('ghost.modules.finance.views.screener.lastUpdated', { 
            time: new Date(lastUpdated).toLocaleTimeString() 
          })}
        </div>
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
