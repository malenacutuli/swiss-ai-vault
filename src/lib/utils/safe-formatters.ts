/**
 * Enterprise-grade safe formatters for numeric display
 * Handles: null, undefined, NaN, Infinity, negative zero, and edge cases
 */

export type Nullable<T> = T | null | undefined;

/**
 * Safely check if a value is a valid displayable number
 */
export function isValidNumber(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    !Number.isNaN(value) &&
    Number.isFinite(value)
  );
}

/**
 * Format a number with locale-aware thousands separators
 * Returns fallback for null/undefined/NaN/Infinity
 */
export function formatNumber(
  value: Nullable<number>,
  options: {
    fallback?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    locale?: string;
  } = {}
): string {
  const {
    fallback = '—',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    locale = 'en-US',
  } = options;

  if (!isValidNumber(value)) {
    return fallback;
  }

  try {
    return value.toLocaleString(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
    });
  } catch (error) {
    console.warn('[formatNumber] Formatting error:', error);
    return fallback;
  }
}

/**
 * Format a number as currency
 */
export function formatCurrency(
  value: Nullable<number>,
  options: {
    fallback?: string;
    currency?: string;
    locale?: string;
    compact?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  const {
    fallback = '—',
    currency = 'USD',
    locale = 'en-US',
    compact = false,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  if (!isValidNumber(value)) {
    return fallback;
  }

  try {
    const formatOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    };

    if (compact) {
      formatOptions.notation = 'compact';
      formatOptions.compactDisplay = 'short';
    }

    return value.toLocaleString(locale, formatOptions);
  } catch (error) {
    console.warn('[formatCurrency] Formatting error:', error);
    return fallback;
  }
}

/**
 * Format a number as percentage
 */
export function formatPercent(
  value: Nullable<number>,
  options: {
    fallback?: string;
    decimals?: number;
    locale?: string;
    includeSign?: boolean;
  } = {}
): string {
  const {
    fallback = '—',
    decimals = 2,
    locale = 'en-US',
    includeSign = false,
  } = options;

  if (!isValidNumber(value)) {
    return fallback;
  }

  try {
    const formatted = value.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    const sign = includeSign && value > 0 ? '+' : '';
    return `${sign}${formatted}%`;
  } catch (error) {
    console.warn('[formatPercent] Formatting error:', error);
    return fallback;
  }
}

/**
 * Format large numbers in compact notation (1.2M, 3.4B, etc.)
 */
export function formatCompact(
  value: Nullable<number>,
  options: {
    fallback?: string;
    locale?: string;
    maximumFractionDigits?: number;
  } = {}
): string {
  const {
    fallback = '—',
    locale = 'en-US',
    maximumFractionDigits = 2,
  } = options;

  if (!isValidNumber(value)) {
    return fallback;
  }

  try {
    return value.toLocaleString(locale, {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits,
    });
  } catch (error) {
    console.warn('[formatCompact] Formatting error:', error);
    return fallback;
  }
}

/**
 * Format market cap with appropriate suffix
 */
export function formatMarketCap(
  value: Nullable<number>,
  options: {
    fallback?: string;
    currency?: string;
  } = {}
): string {
  const { fallback = '—', currency = '$' } = options;

  if (!isValidNumber(value)) {
    return fallback;
  }

  try {
    if (value >= 1e12) {
      return `${currency}${(value / 1e12).toFixed(2)}T`;
    } else if (value >= 1e9) {
      return `${currency}${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `${currency}${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `${currency}${(value / 1e3).toFixed(2)}K`;
    } else {
      return `${currency}${value.toFixed(2)}`;
    }
  } catch (error) {
    console.warn('[formatMarketCap] Formatting error:', error);
    return fallback;
  }
}

/**
 * Format crypto price (handles very small and very large values)
 */
export function formatCryptoPrice(
  value: Nullable<number>,
  options: {
    fallback?: string;
    currency?: string;
  } = {}
): string {
  const { fallback = '—', currency = '$' } = options;

  if (!isValidNumber(value)) {
    return fallback;
  }

  try {
    // Very small prices (< $0.01) - show more decimals
    if (value > 0 && value < 0.01) {
      // Find first significant digit
      const decimals = Math.max(2, Math.ceil(-Math.log10(value)) + 2);
      return `${currency}${value.toFixed(Math.min(decimals, 8))}`;
    }

    // Small prices ($0.01 - $1) - 4 decimals
    else if (value < 1) {
      return `${currency}${value.toFixed(4)}`;
    }

    // Medium prices ($1 - $1000) - 2 decimals
    else if (value < 1000) {
      return `${currency}${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    // Large prices (> $1000) - no decimals, with commas
    else {
      return `${currency}${value.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    }
  } catch (error) {
    console.warn('[formatCryptoPrice] Formatting error:', error);
    return fallback;
  }
}

/**
 * Format volume with appropriate suffix
 */
export function formatVolume(
  value: Nullable<number>,
  options: {
    fallback?: string;
    currency?: string;
  } = {}
): string {
  return formatMarketCap(value, options); // Same logic
}

/**
 * Get CSS class for price change (positive/negative)
 */
export function getPriceChangeClass(value: Nullable<number>): string {
  if (!isValidNumber(value)) {
    return 'text-muted-foreground';
  }

  if (value > 0) {
    return 'text-green-500';
  }

  if (value < 0) {
    return 'text-red-500';
  }

  return 'text-muted-foreground';
}

/**
 * Get arrow icon for price change
 */
export function getPriceChangeIcon(value: Nullable<number>): '↑' | '↓' | '→' {
  if (!isValidNumber(value) || value === 0) {
    return '→';
  }

  return value > 0 ? '↑' : '↓';
}
