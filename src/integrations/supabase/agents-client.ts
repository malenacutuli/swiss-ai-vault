/**
 * Agents-specific Supabase client for direct project connection
 * 
 * This client connects to the dedicated agents Supabase project (ghmmdochvlrnwbruyrqk)
 * allowing Claude Code to deploy agent-specific edge functions and migrations
 * without conflicting with Lovable Cloud auto-deployment.
 * 
 * Authentication uses JWT passthrough - Lovable auth tokens are verified on this project.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Direct Supabase project for agents (deployed via Claude Code)
const AGENTS_SUPABASE_URL = import.meta.env.VITE_AGENTS_SUPABASE_URL || 'https://ghmmdochvlrnwbruyrqk.supabase.co';
const AGENTS_SUPABASE_KEY = import.meta.env.VITE_AGENTS_SUPABASE_KEY || import.meta.env.VITE_EXTERNAL_SUPABASE_PUBLISHABLE_KEY;

// Import the agents supabase client like this:
// import { supabaseAgents } from "@/integrations/supabase/agents-client";

export const supabaseAgents = createClient<Database>(
  AGENTS_SUPABASE_URL,
  AGENTS_SUPABASE_KEY || '',
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// Helper to check if agents client is properly configured
export const isAgentsClientConfigured = (): boolean => {
  return !!(AGENTS_SUPABASE_URL && AGENTS_SUPABASE_KEY);
};

// Get the configured agents project URL (for display/debugging)
export const getAgentsProjectUrl = (): string => AGENTS_SUPABASE_URL;
