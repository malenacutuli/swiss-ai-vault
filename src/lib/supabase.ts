/**
 * HELIOS Supabase client
 *
 * Uses the dev Supabase project (ghmmdochvlrnwbruyrqk) for HELIOS
 * Same as agents-dev to keep all Claude Code features on one backend
 */
import { createClient } from '@supabase/supabase-js';

// Dev Supabase project (SwissVault.ai - ghmmdochvlrnwbruyrqk)
// This is where helios-chat edge function is deployed
const HELIOS_SUPABASE_URL = import.meta.env.VITE_AGENTS_DEV_SUPABASE_URL || 'https://ghmmdochvlrnwbruyrqk.supabase.co';
const HELIOS_SUPABASE_KEY = import.meta.env.VITE_AGENTS_DEV_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTcxMzMsImV4cCI6MjA4MDQzMzEzM30.jUOFsOsCq36umtlnfxsW9tnDpPio0MNh2E11uX3SaEw';

export const supabase = createClient(
  HELIOS_SUPABASE_URL,
  HELIOS_SUPABASE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// Helper to check if HELIOS backend is configured
export function isHeliosConfigured(): boolean {
  return Boolean(HELIOS_SUPABASE_URL && HELIOS_SUPABASE_KEY);
}
