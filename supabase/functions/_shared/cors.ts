// supabase/functions/_shared/cors.ts
// Shared CORS configuration for all edge functions

export const ALLOWED_ORIGINS = [
  'https://swissbrain.ai',
  'https://www.swissbrain.ai',
  'https://app.swissbrain.ai',
  'https://swissvault.ai',
  'https://www.swissvault.ai',
  'https://app.swissvault.ai',
  'http://localhost:5173',
  'http://localhost:3000',
];

export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  
  // Check if origin is in allowed list or matches lovable.app/lovableproject.com pattern
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || 
                    origin.endsWith('.lovable.app') ||
                    origin.endsWith('.lovableproject.com');
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCors(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  return null;
}

// Simple corsHeaders for backward compatibility
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};
