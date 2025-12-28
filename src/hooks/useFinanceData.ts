import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

interface FinanceDataResult<T> {
  data: T | null;
  citations: string[];
  source: string;
  lastUpdated: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

type FinanceDataType = 'predictions' | 'earnings' | 'crypto' | 'markets' | 'watchlist' | 'screener';

export function useFinanceData<T>(
  type: FinanceDataType,
  region?: string
): FinanceDataResult<T> {
  const { i18n } = useTranslation();
  const [data, setData] = useState<T | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [source, setSource] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fetchError } = await supabase.functions.invoke('ghost-finance-data', {
        body: {
          type,
          region,
          language: i18n.language,
        },
      });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      setData(result?.data || null);
      setCitations(result?.citations || []);
      setSource(result?.source || '');
      setLastUpdated(result?.lastUpdated || null);
    } catch (err) {
      console.error(`[useFinanceData] Error fetching ${type}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [type, region, i18n.language]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    citations,
    source,
    lastUpdated,
    isLoading,
    error,
    refresh: fetchData,
  };
}

// Specific type exports for convenience
export interface PredictionMarket {
  question: string;
  category: string;
  volume: string;
  options: { label: string; probability: number }[];
  source: string;
}

export interface EarningsEvent {
  company: string;
  symbol: string;
  date: string;
  time: string;
  estimate: string;
  actual?: string;
}

export interface EarningsData {
  upcoming: EarningsEvent[];
  recent: EarningsEvent[];
}

export interface CryptoAsset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: string;
}

export interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface RegionalMarketData {
  markets: MarketData[];
  summary: string;
}

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  marketCap: string;
  pe: number;
  dividend: number;
  sector: string;
}

export interface WatchlistStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}
