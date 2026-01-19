import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Separate Supabase client for Agent features only
 *
 * This client connects to the Direct project (ghmmdochvlrnwbruyrqk)
 * where agent Edge Functions are deployed.
 *
 * Use this client ONLY for:
 * - agent-execute-phase2
 * - agent-status-phase2
 * - agent-logs-phase2
 *
 * All other features (auth, storage, datasets, etc.) use the main client.
 */

const AGENT_SUPABASE_URL = 'https://auth.swissvault.ai';
const AGENT_SUPABASE_KEY = import.meta.env.VITE_AGENT_SUPABASE_ANON_KEY;

if (!AGENT_SUPABASE_KEY) {
  console.error('VITE_AGENT_SUPABASE_ANON_KEY is not set. Agent features will not work.');
}

export const agentSupabase = createClient<Database>(
  AGENT_SUPABASE_URL,
  AGENT_SUPABASE_KEY || '',
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
 * Helper to call agent Edge Functions
 * Automatically uses the agent client with proper auth headers
 */
export async function callAgentFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    // Get the current session from main auth (they're shared via localStorage)
    const { data: { session } } = await agentSupabase.auth.getSession();

    if (!session) {
      return {
        data: null,
        error: new Error('Not authenticated'),
      };
    }

    const response = await agentSupabase.functions.invoke(functionName, {
      body,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.error) {
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
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Query agent data directly from database
 * Use this for agent_runs, agent_steps, agent_messages, etc.
 */
export function queryAgentData() {
  return agentSupabase.from.bind(agentSupabase);
}
