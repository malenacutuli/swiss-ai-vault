import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Development Supabase client for testing Claude Code agent implementations
 *
 * This client connects to the Direct project (ghmmdochvlrnwbruyrqk)
 * specifically for testing /agents-dev route WITHOUT affecting production /ghost/agents.
 *
 * Use this client ONLY in:
 * - /agents-dev route
 * - useAgentExecutionDev hook
 * - AgentsDev.tsx component
 *
 * Backend: FastAPI agent-api running on Kubernetes
 * Edge Functions: agent-execute, agent-status, agent-logs (Phase 2+)
 */

// Direct Supabase project configuration (SwissVault.ai - ghmmdochvlrnwbruyrqk)
const AGENTS_DEV_SUPABASE_URL = import.meta.env.VITE_AGENTS_DEV_SUPABASE_URL || 'https://ghmmdochvlrnwbruyrqk.supabase.co';
const AGENTS_DEV_SUPABASE_KEY = import.meta.env.VITE_AGENTS_DEV_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTcxMzMsImV4cCI6MjA4MDQzMzEzM30.jUOFsOsCq36umtlnfxsW9tnDpPio0MNh2E11uX3SaEw';

if (!import.meta.env.VITE_AGENTS_DEV_SUPABASE_ANON_KEY) {
  console.info('[agents-client-dev] Using default anon key for SwissVault.ai project');
}

export const agentsDevSupabase = createClient<Database>(
  AGENTS_DEV_SUPABASE_URL,
  AGENTS_DEV_SUPABASE_KEY,
  {
    auth: {
      // Use the same auth storage as main client for seamless user experience
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

/**
 * Helper to call Claude Code agent Edge Functions
 * Automatically uses the dev client with proper auth headers
 */
export async function callAgentDevFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    console.log(`[agents-client-dev] Calling ${functionName}:`, body);

    // Get the current session from main auth (they're shared via localStorage)
    const { data: { session } } = await agentsDevSupabase.auth.getSession();

    if (!session) {
      console.error('[agents-client-dev] Not authenticated');
      return {
        data: null,
        error: new Error('Not authenticated'),
      };
    }

    const response = await agentsDevSupabase.functions.invoke(functionName, {
      body,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    console.log(`[agents-client-dev] ${functionName} response:`, response);

    if (response.error) {
      console.error(`[agents-client-dev] ${functionName} error:`, response.error);
      return {
        data: null,
        error: response.error,
      };
    }

    return {
      data: response.data as T,
      error: null,
    };
  } catch (error) {
    console.error(`[agents-client-dev] ${functionName} exception:`, error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Query agent data directly from dev database
 * Use this for agent_runs, agent_steps, agent_messages, etc.
 */
export function queryAgentDevData() {
  return agentsDevSupabase.from.bind(agentsDevSupabase);
}

/**
 * Check if dev client is properly configured
 */
export function isDevClientConfigured(): boolean {
  return !!AGENTS_DEV_SUPABASE_KEY;
}

/**
 * Get configuration status for debugging
 */
export function getDevClientConfig() {
  return {
    url: AGENTS_DEV_SUPABASE_URL,
    hasKey: !!AGENTS_DEV_SUPABASE_KEY,
    keyPreview: AGENTS_DEV_SUPABASE_KEY ? `${AGENTS_DEV_SUPABASE_KEY.slice(0, 20)}...` : 'NOT SET',
  };
}
