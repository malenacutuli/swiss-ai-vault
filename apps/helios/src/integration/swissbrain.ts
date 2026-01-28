/**
 * SwissBrAIn Platform Integration
 * Connects HELIOS to main SwissBrAIn infrastructure
 */

import { createClient } from '@supabase/supabase-js';
import type { CaseState, SupportedLanguage } from '../types/index.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Supabase client for SwissBrAIn database
const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    db: { schema: 'helios' },
  }
);

/**
 * Create HELIOS session in SwissBrAIn database
 */
export async function createSession(
  userId: string | null,
  language: string,
  tenantId?: string
): Promise<CaseState> {
  const { data, error } = await supabase
    .from('case_sessions')
    .insert({
      patient_id: userId,
      tenant_id: tenantId,
      language,
      current_phase: 'intake',
      messages: [],
      symptom_entities: [],
      hypothesis_list: [],
      red_flags: [],
      escalation_triggered: false,
      metadata: {
        platform: 'swissbrain',
        version: '1.0.0',
      },
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create session', { error });
    throw error;
  }

  return data;
}

/**
 * Load session from database
 */
export async function loadSession(sessionId: string): Promise<CaseState | null> {
  const { data, error } = await supabase
    .from('case_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) {
    logger.error('Failed to load session', { sessionId, error });
    return null;
  }

  return data;
}

/**
 * Save session state
 */
export async function saveSession(
  sessionId: string,
  updates: Partial<CaseState>
): Promise<void> {
  const { error } = await supabase
    .from('case_sessions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId);

  if (error) {
    logger.error('Failed to save session', { sessionId, error });
    throw error;
  }
}

/**
 * Add message to session
 */
export async function addMessage(
  sessionId: string,
  message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    language: SupportedLanguage;
  }
): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session) throw new Error('Session not found');

  const newMessage = {
    message_id: crypto.randomUUID(),
    ...message,
    timestamp: new Date().toISOString(),
  };

  await saveSession(sessionId, {
    messages: [...session.messages, newMessage as CaseState['messages'][number]],
  });
}

/**
 * Append to audit log
 */
export async function appendAuditLog(
  sessionId: string,
  eventType: string,
  actorType: string,
  actorId: string,
  payload: Record<string, unknown>,
  language: string
): Promise<void> {
  // Get previous hash for chain
  const { data: lastLog } = await supabase
    .from('audit_log')
    .select('event_hash')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const previousHash = lastLog?.event_hash || 'genesis';

  // Generate hash for this event
  const eventData = JSON.stringify({
    sessionId,
    eventType,
    actorType,
    actorId,
    payload,
    previousHash,
    timestamp: new Date().toISOString(),
  });
  const eventHash = await generateHash(eventData);

  const { error } = await supabase
    .from('audit_log')
    .insert({
      session_id: sessionId,
      event_type: eventType,
      actor_type: actorType,
      actor_id: actorId,
      event_payload: payload,
      language,
      previous_hash: previousHash,
      event_hash: eventHash,
    });

  if (error) {
    logger.error('Failed to append audit log', { sessionId, error });
    throw error;
  }
}

/**
 * Generate SHA-256 hash
 */
async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Link HELIOS session to SwissBrAIn user
 */
export async function linkToUser(
  sessionId: string,
  userId: string
): Promise<void> {
  await saveSession(sessionId, {
    patient_id: userId,
  } as Partial<CaseState>);
}

/**
 * Get sessions for user
 */
export async function getUserSessions(
  userId: string,
  limit = 10
): Promise<CaseState[]> {
  const { data, error } = await supabase
    .from('case_sessions')
    .select('*')
    .eq('patient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to get user sessions', { userId, error });
    return [];
  }

  return data || [];
}
