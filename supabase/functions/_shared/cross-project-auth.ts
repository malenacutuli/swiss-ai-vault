// Cross-project authentication helper
// Allows edge functions on the direct project to validate tokens from Lovable project

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Lovable-managed project credentials (for cross-project auth)
const LOVABLE_SUPABASE_URL = 'https://rljnrgscmosgkcjdvlrq.supabase.co';
const LOVABLE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsam5yZ3NjbW9zZ2tjamR2bHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDIxNzIsImV4cCI6MjA4MDQxODE3Mn0.C_Y5OyGaIH3QPX15QTfwafe-_y7YzHvO4z6HU55Y1-A';

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
 * Authenticate a user token against both local and Lovable projects
 * Tries local project first, falls back to Lovable project
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

  // Fallback: Try Lovable project auth
  try {
    const lovableClient = createClient(LOVABLE_SUPABASE_URL, LOVABLE_ANON_KEY);
    const { data: lovableAuth, error: lovableError } = await lovableClient.auth.getUser(token);

    if (!lovableError && lovableAuth?.user) {
      console.log('[cross-project-auth] Authenticated via Lovable project');
      return {
        user: lovableAuth.user,
        error: null,
        source: 'lovable',
      };
    }
  } catch (e) {
    console.error('[cross-project-auth] Lovable auth error:', e);
  }

  console.log('[cross-project-auth] Authentication failed on both projects');
  return {
    user: null,
    error: 'Invalid token',
    source: null,
  };
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  return authHeader.replace('Bearer ', '');
}
