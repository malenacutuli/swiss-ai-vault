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
 * Decode base64url (JWT uses URL-safe base64)
 */
function base64UrlDecode(str: string): string {
  // Replace URL-safe characters back to standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const pad = base64.length % 4;
  if (pad) {
    base64 += '='.repeat(4 - pad);
  }
  return atob(base64);
}

/**
 * Decode a JWT token without verification (for cross-project auth)
 */
function decodeJWT(token: string): { header: any; payload: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('[cross-project-auth] Invalid JWT format, parts:', parts.length);
      return null;
    }

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    console.log('[cross-project-auth] JWT decoded successfully, sub:', payload.sub);
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
 * Extract project reference from Supabase issuer URL
 * Format: https://<project-ref>.supabase.co/auth/v1
 */
function extractProjectRef(iss: string): string | null {
  if (!iss) return null;
  const match = iss.match(/https:\/\/([a-z0-9]+)\.supabase\.co\/auth\/v1/);
  return match ? match[1] : null;
}

/**
 * Authenticate a user token against both local and Lovable projects
 * Tries local project first, falls back to decoding Lovable tokens
 */
export async function authenticateToken(
  token: string,
  localSupabase: SupabaseClient
): Promise<AuthResult> {
  console.log('[cross-project-auth] Starting auth, token length:', token?.length);

  // Validate token exists
  if (!token || token.length < 10) {
    console.log('[cross-project-auth] Token is empty or too short');
    return { user: null, error: 'Token is empty or invalid', source: null };
  }

  // Try local project auth first (wrapped in try-catch for safety)
  try {
    const { data: localAuth, error: localError } = await localSupabase.auth.getUser(token);

    console.log('[cross-project-auth] Local auth result:', {
      hasUser: !!localAuth?.user,
      userId: localAuth?.user?.id?.slice(0, 8),
      error: localError?.message,
      errorCode: (localError as any)?.code
    });

    if (!localError && localAuth?.user) {
      console.log('[cross-project-auth] Authenticated via local project, user:', localAuth.user.id.slice(0, 8));
      return {
        user: localAuth.user,
        error: null,
        source: 'local',
      };
    }
  } catch (localAuthError) {
    console.error('[cross-project-auth] Local auth threw exception:', localAuthError);
    // Continue to JWT decode fallback
  }

  console.log('[cross-project-auth] Local auth failed, trying JWT decode fallback');

  // Fallback: Decode and validate Lovable project token
  let decoded;
  try {
    decoded = decodeJWT(token);
  } catch (decodeError) {
    console.error('[cross-project-auth] JWT decode threw:', decodeError);
    return { user: null, error: 'Token decode failed', source: null };
  }

  if (!decoded) {
    console.log('[cross-project-auth] Failed to decode token - decodeJWT returned null');
    return { user: null, error: 'Invalid token format', source: null };
  }

  const { payload } = decoded;

  if (!payload) {
    console.log('[cross-project-auth] Decoded token has no payload');
    return { user: null, error: 'Token payload missing', source: null };
  }

  // Log payload keys for debugging (not full content for security)
  console.log('[cross-project-auth] Token payload keys:', Object.keys(payload));
  console.log('[cross-project-auth] Token payload essentials:', {
    sub: payload.sub?.slice(0, 8),
    iss: payload.iss,
    role: payload.role,
    exp: payload.exp,
    aud: payload.aud
  });

  // Extract and validate project reference from issuer URL
  // iss format: https://<project-ref>.supabase.co/auth/v1
  const projectRef = extractProjectRef(payload.iss);

  if (!projectRef) {
    console.log('[cross-project-auth] Could not extract project ref from iss:', payload.iss);
    return { user: null, error: 'Invalid token issuer format', source: null };
  }

  if (projectRef !== LOVABLE_PROJECT_REF) {
    console.log('[cross-project-auth] Token not from Lovable project. Got:', projectRef, 'Expected:', LOVABLE_PROJECT_REF);
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
    console.log('[cross-project-auth] Invalid token claims - userId:', userId, 'role:', role);
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
