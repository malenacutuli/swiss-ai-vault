import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  RefreshCw, 
  Search,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CryptoErrorBoundary } from '@/components/error/CryptoErrorBoundary';
import {
  formatCryptoPrice,
  formatMarketCap,
  formatVolume,
  formatPercent,
  formatNumber,
  getPriceChangeClass,
  isValidNumber,
} from '@/lib/utils/safe-formatters';
import { parseCryptoData, type CryptoData } from '@/types/crypto';

// ============================================================================
// TYPES
// ============================================================================

interface CryptoMarketViewProps {
  onCryptoSelect?: (crypto: CryptoData) => void;
  maxItems?: number;
  showSearch?: boolean;
  compact?: boolean;
}

type SortField = 'market_cap_rank' | 'current_price' | 'price_change_percentage_24h' | 'market_cap' | 'total_volume';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// LOADING SKELETON
// ============================================================================

function CryptoTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24 ml-auto" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function CryptoEmptyState({ searchQuery }: { searchQuery?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-lg font-medium mb-1">No Cryptocurrencies Found</p>
      <p className="text-sm text-muted-foreground">
        {searchQuery
          ? `No results for "${searchQuery}". Try a different search term.`
          : 'Unable to load cryptocurrency data. Please try again later.'}
      </p>
    </div>
  );
}

// ============================================================================
// PRICE CHANGE CELL
// ============================================================================

function PriceChangeCell({ value }: { value: number | null | undefined }) {
  const colorClass = getPriceChangeClass(value);
  const formatted = formatPercent(value, { includeSign: true });
  
  const Icon = useMemo(() => {
    if (!isValidNumber(value) || value === 0) return Minus;
    return value > 0 ? TrendingUp : TrendingDown;
  }, [value]);

  return (
    <span className={`flex items-center gap-1 ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {formatted}
    </span>
  );
}

// ============================================================================
// CRYPTO ROW
// ============================================================================

interface CryptoRowProps {
  crypto: CryptoData;
  onClick?: () => void;
  compact?: boolean;
}

function CryptoRow({ crypto, onClick, compact }: CryptoRowProps) {
  return (
    <TableRow 
      className={onClick ? 'cursor-pointer hover:bg-muted/50' : undefined}
      onClick={onClick}
    >
      {/* Rank */}
      <TableCell className="font-medium w-12">
        {formatNumber(crypto.market_cap_rank, { fallback: '—' })}
      </TableCell>

      {/* Name & Symbol */}
      <TableCell>
        <div className="flex items-center gap-3">
          {crypto.image ? (
            <img
              src={crypto.image}
              alt={crypto.name}
              className="h-8 w-8 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
              {crypto.symbol?.charAt(0) || '?'}
            </div>
          )}
          <div>
            <p className="font-medium">{crypto.name}</p>
            <Badge variant="secondary" className="text-xs">
              {crypto.symbol}
            </Badge>
          </div>
        </div>
      </TableCell>

      {/* Price */}
      <TableCell className="font-mono text-right">
        {formatCryptoPrice(crypto.current_price)}
      </TableCell>

      {/* 24h Change */}
      <TableCell className="text-right">
        <PriceChangeCell value={crypto.price_change_percentage_24h} />
      </TableCell>

      {/* Market Cap (hide on compact) */}
      {!compact && (
        <TableCell className="text-right font-mono">
          {formatMarketCap(crypto.market_cap)}
        </TableCell>
      )}

      {/* Volume (hide on compact) */}
      {!compact && (
        <TableCell className="text-right font-mono">
          {formatVolume(crypto.total_volume)}
        </TableCell>
      )}
    </TableRow>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function CryptoMarketViewInner({
  onCryptoSelect,
  maxItems = 100,
  showSearch = true,
  compact = false,
}: CryptoMarketViewProps) {
  // State
  const [cryptos, setCryptos] = useState<CryptoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('market_cap_rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch data
  const fetchCryptoData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${maxItems}&page=1&sparkline=false`
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const rawData = await response.json();
      
      // Use safe parser that handles null/undefined
      const validatedData = parseCryptoData(rawData);
      
      if (validatedData.length === 0) {
        console.warn('[CryptoMarketView] No valid crypto data returned');
      }

      setCryptos(validatedData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[CryptoMarketView] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [maxItems]);

  // Initial fetch
  useEffect(() => {
    fetchCryptoData();
  }, [fetchCryptoData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchCryptoData, 60000);
    return () => clearInterval(interval);
  }, [fetchCryptoData]);

  // Filter and sort
  const filteredAndSortedCryptos = useMemo(() => {
    let result = [...cryptos];

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.symbol.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      // Handle null/undefined - push to end
      if (!isValidNumber(aVal) && !isValidNumber(bVal)) return 0;
      if (!isValidNumber(aVal)) return 1;
      if (!isValidNumber(bVal)) return -1;

      const comparison = aVal - bVal;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [cryptos, searchQuery, sortField, sortDirection]);

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Render sort indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  // Error state
  if (error && cryptos.length === 0) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Data</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchCryptoData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Cryptocurrency Market
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={fetchCryptoData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {showSearch && (
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search cryptocurrencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading && cryptos.length === 0 ? (
          <CryptoTableSkeleton rows={10} />
        ) : filteredAndSortedCryptos.length === 0 ? (
          <CryptoEmptyState searchQuery={searchQuery} />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="w-12 cursor-pointer hover:bg-muted/50" 
                    onClick={() => handleSort('market_cap_rank')}
                  >
                    #<SortIndicator field="market_cap_rank" />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50" 
                    onClick={() => handleSort('current_price')}
                  >
                    Price<SortIndicator field="current_price" />
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50" 
                    onClick={() => handleSort('price_change_percentage_24h')}
                  >
                    24h<SortIndicator field="price_change_percentage_24h" />
                  </TableHead>
                  {!compact && (
                    <>
                      <TableHead 
                        className="text-right cursor-pointer hover:bg-muted/50" 
                        onClick={() => handleSort('market_cap')}
                      >
                        Market Cap<SortIndicator field="market_cap" />
                      </TableHead>
                      <TableHead 
                        className="text-right cursor-pointer hover:bg-muted/50" 
                        onClick={() => handleSort('total_volume')}
                      >
                        Volume<SortIndicator field="total_volume" />
                      </TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedCryptos.map((crypto) => (
                  <CryptoRow
                    key={crypto.id}
                    crypto={crypto}
                    onClick={onCryptoSelect ? () => onCryptoSelect(crypto) : undefined}
                    compact={compact}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Show count */}
        {filteredAndSortedCryptos.length > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>
              Showing {filteredAndSortedCryptos.length} of {cryptos.length} cryptocurrencies
            </span>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="h-6 text-xs"
              >
                Clear search
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// EXPORTED COMPONENT WITH ERROR BOUNDARY
// ============================================================================

export function CryptoMarketView(props: CryptoMarketViewProps) {
  const [key, setKey] = useState(0);

  const handleRetry = () => {
    setKey((prev) => prev + 1);
  };

  return (
    <CryptoErrorBoundary onRetry={handleRetry}>
      <CryptoMarketViewInner key={key} {...props} />
    </CryptoErrorBoundary>
  );
}

export default CryptoMarketView;
