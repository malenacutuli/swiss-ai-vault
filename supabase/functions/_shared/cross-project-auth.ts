// Cross-project authentication helper
// Allows edge functions on the direct project to validate tokens from Lovable project

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Lovable project reference for token validation
const LOVABLE_PROJECT_REF = 'rljnrgscmosgkcjdvlrq';

export interface AuthResult {
  user: {
    id: string;
    email?: string;
    [key: string]: unknown;
  } | null;
  error: string | null;
  source: 'local' | 'lovable' | null;
}

/**
 * Decode a JWT token without verification (for cross-project auth)
 */
function decodeJWT(token: string): { header: any; payload: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    return { header, payload };
  } catch (e) {
    console.error('[cross-project-auth] JWT decode error:', e);
    return null;
  }
}

/**
 * Check if token is expired
 */
function isTokenExpired(payload: any): boolean {
  if (!payload.exp) return false;
  return Date.now() >= payload.exp * 1000;
}

/**
 * Authenticate a user token against both local and Lovable projects
 * Tries local project first, falls back to decoding Lovable tokens
 */
export async function authenticateToken(
  token: string,
  localSupabase: SupabaseClient
): Promise<AuthResult> {
  // Try local project auth first
  const { data: localAuth, error: localError } = await localSupabase.auth.getUser(token);

  if (!localError && localAuth?.user) {
    console.log('[cross-project-auth] Authenticated via local project');
    return {
      user: localAuth.user,
      error: null,
      source: 'local',
    };
  }

  // Fallback: Decode and validate Lovable project token
  // Since we can't verify the signature across projects, we decode and check claims
  const decoded = decodeJWT(token);

  if (!decoded) {
    console.log('[cross-project-auth] Failed to decode token');
    return { user: null, error: 'Invalid token format', source: null };
  }

  const { payload } = decoded;

  // Check if token is from Lovable project
  if (payload.iss !== 'supabase' || payload.ref !== LOVABLE_PROJECT_REF) {
    console.log('[cross-project-auth] Token not from Lovable project:', payload.ref);
    return { user: null, error: 'Invalid token issuer', source: null };
  }

  // Check expiration
  if (isTokenExpired(payload)) {
    console.log('[cross-project-auth] Token expired');
    return { user: null, error: 'Token expired', source: null };
  }

  // Extract user info from token
  const userId = payload.sub;
  const email = payload.email;
  const role = payload.role;

  if (!userId || role !== 'authenticated') {
    console.log('[cross-project-auth] Invalid token claims');
    return { user: null, error: 'Invalid token claims', source: null };
  }

  console.log('[cross-project-auth] Authenticated via Lovable token decode, user:', userId);

  return {
    user: {
      id: userId,
      email: email,
      role: role,
      aud: payload.aud,
    },
    error: null,
    source: 'lovable',
  };
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  return authHeader.replace('Bearer ', '');
}
