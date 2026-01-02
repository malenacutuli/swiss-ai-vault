import { z } from 'zod';

/**
 * Raw API response type (all fields potentially null/undefined)
 */
export interface RawCryptoData {
  id?: string | null;
  symbol?: string | null;
  name?: string | null;
  image?: string | null;
  current_price?: number | null;
  market_cap?: number | null;
  market_cap_rank?: number | null;
  fully_diluted_valuation?: number | null;
  total_volume?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  price_change_24h?: number | null;
  price_change_percentage_24h?: number | null;
  price_change_percentage_7d?: number | null;
  price_change_percentage_30d?: number | null;
  market_cap_change_24h?: number | null;
  market_cap_change_percentage_24h?: number | null;
  circulating_supply?: number | null;
  total_supply?: number | null;
  max_supply?: number | null;
  ath?: number | null;
  ath_change_percentage?: number | null;
  ath_date?: string | null;
  atl?: number | null;
  atl_change_percentage?: number | null;
  atl_date?: string | null;
  last_updated?: string | null;
  sparkline_in_7d?: { price?: number[] | null } | null;
}

/**
 * Zod schema for validating and transforming crypto data
 * Provides safe defaults for null/undefined values
 */
export const CryptoDataSchema = z.object({
  id: z.string().nullish().transform(v => v ?? 'unknown'),
  symbol: z.string().nullish().transform(v => v?.toUpperCase() ?? '???'),
  name: z.string().nullish().transform(v => v ?? 'Unknown'),
  image: z.string().nullish(),
  current_price: z.number().nullish(),
  market_cap: z.number().nullish(),
  market_cap_rank: z.number().nullish(),
  fully_diluted_valuation: z.number().nullish(),
  total_volume: z.number().nullish(),
  high_24h: z.number().nullish(),
  low_24h: z.number().nullish(),
  price_change_24h: z.number().nullish(),
  price_change_percentage_24h: z.number().nullish(),
  price_change_percentage_7d: z.number().nullish(),
  price_change_percentage_30d: z.number().nullish(),
  market_cap_change_24h: z.number().nullish(),
  market_cap_change_percentage_24h: z.number().nullish(),
  circulating_supply: z.number().nullish(),
  total_supply: z.number().nullish(),
  max_supply: z.number().nullish(),
  ath: z.number().nullish(),
  ath_change_percentage: z.number().nullish(),
  ath_date: z.string().nullish(),
  atl: z.number().nullish(),
  atl_change_percentage: z.number().nullish(),
  atl_date: z.string().nullish(),
  last_updated: z.string().nullish(),
  sparkline_in_7d: z.object({
    price: z.array(z.number()).nullish(),
  }).nullish(),
});

export type CryptoData = z.infer<typeof CryptoDataSchema>;

/**
 * Safely parse and validate crypto data array
 */
export function parseCryptoData(data: unknown): CryptoData[] {
  if (!Array.isArray(data)) {
    console.warn('[parseCryptoData] Expected array, got:', typeof data);
    return [];
  }

  return data
    .map((item, index) => {
      try {
        return CryptoDataSchema.parse(item);
      } catch (error) {
        console.warn(`[parseCryptoData] Failed to parse item ${index}:`, error);
        return null;
      }
    })
    .filter((item): item is CryptoData => item !== null);
}
