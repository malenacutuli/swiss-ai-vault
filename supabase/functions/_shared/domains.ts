// supabase/functions/_shared/domains.ts
// Shared domain utilities for edge functions

export const ALLOWED_DOMAINS = [
  'swissbrain.ai',
  'www.swissbrain.ai',
  'app.swissbrain.ai',
  'swissvault.ai',
  'www.swissvault.ai',
  'app.swissvault.ai',
];

/**
 * Determine the base URL for redirects based on request origin/referer
 */
export function getAppBaseUrl(request: Request): string {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Check origin first
  if (origin?.includes('swissbrain')) {
    return 'https://swissbrain.ai';
  }
  if (origin?.includes('swissvault')) {
    return 'https://swissvault.ai';
  }
  
  // Check referer as fallback
  if (referer?.includes('swissbrain')) {
    return 'https://swissbrain.ai';
  }
  if (referer?.includes('swissvault')) {
    return 'https://swissvault.ai';
  }
  
  // Handle lovable.app/lovableproject.com preview domains
  if (origin?.endsWith('.lovable.app') || origin?.endsWith('.lovableproject.com')) {
    return origin;
  }
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.hostname.endsWith('.lovable.app') || refererUrl.hostname.endsWith('.lovableproject.com')) {
        return refererUrl.origin;
      }
    } catch {
      // Invalid referer URL, ignore
    }
  }
  
  // Handle localhost
  if (origin?.includes('localhost')) {
    return origin;
  }
  
  // Default to primary domain
  return 'https://swissbrain.ai';
}

/**
 * Get brand name based on request origin
 */
export function getBrandFromRequest(request: Request): 'SwissBrain' | 'SwissVault' {
  const baseUrl = getAppBaseUrl(request);
  return baseUrl.includes('swissvault') ? 'SwissVault' : 'SwissBrain';
}
