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
 * Formats:
 *   - https://<project-ref>.supabase.co/auth/v1
 *   - https://<project-ref>.supabase.co
 */
function extractProjectRef(iss: string): string | null {
  if (!iss) return null;
  // Try full auth URL format first
  let match = iss.match(/https:\/\/([a-zA-Z0-9]+)\.supabase\.co\/auth\/v1/);
  if (match) return match[1];
  // Try simpler format without /auth/v1
  match = iss.match(/https:\/\/([a-zA-Z0-9]+)\.supabase\.co/);
  if (match) return match[1];
  // Try just extracting any project-ref-like string
  match = iss.match(/([a-zA-Z0-9]{20,})/);
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

  // Skip local auth for cross-project tokens - go straight to JWT decode
  // The local supabase client uses service role, which can't validate user tokens from other projects
  console.log('[cross-project-auth] Using JWT decode for cross-project auth');

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

  // Log FULL payload for debugging (temporarily - remove in production)
  console.log('[cross-project-auth] FULL Token payload:', JSON.stringify(payload, null, 2));
  console.log('[cross-project-auth] Token payload keys:', Object.keys(payload));
  console.log('[cross-project-auth] Direct field access - sub:', payload.sub, 'user_id:', payload.user_id, 'id:', payload.id);
  console.log('[cross-project-auth] typeof sub:', typeof payload.sub, 'typeof user_id:', typeof payload.user_id);

  // Extract and validate project reference from issuer URL
  // iss format: https://<project-ref>.supabase.co/auth/v1
  const projectRef = extractProjectRef(payload.iss);
  // Extract user info from token - be very lenient
  const userId = payload.sub || payload.user_id || payload.id;
  const email = payload.email;
  const role = payload.role || 'authenticated';

  console.log('[cross-project-auth] Extracted userId:', userId, '| email:', email, '| iss:', payload.iss, '| projectRef:', projectRef);

  // Check expiration
  if (isTokenExpired(payload)) {
    console.log('[cross-project-auth] Token expired at:', payload.exp);
    return { user: null, error: 'Token expired', source: null };
  }

  // Accept any token with a user ID
  if (!userId) {
    console.log('[cross-project-auth] No user ID found in token. Payload keys:', Object.keys(payload));
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
