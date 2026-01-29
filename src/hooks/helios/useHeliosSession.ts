/**
 * HELIOS Session Hook
 * Manages session state and API communication
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message, RedFlag, SupportedLanguage } from '@/lib/helios/types';

interface SessionState {
  sessionId: string | null;
  phase: string;
  triageLevel: string | null;
  disposition: string | null;
}

export function useHeliosSession(language: SupportedLanguage) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start new session
  const startSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('helios-session', {
        body: { action: 'create', language },
      });

      if (fnError) throw fnError;

      setSession({
        sessionId: data.session_id,
        phase: data.phase,
        triageLevel: null,
        disposition: null,
      });

      // Add greeting message
      setMessages([{
        message_id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        language,
        timestamp: new Date().toISOString(),
      }]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!session?.sessionId) return;

    setIsLoading(true);
    setError(null);

    // Add user message immediately
    const userMessage: Message = {
      message_id: crypto.randomUUID(),
      role: 'user',
      content,
      language,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('helios-session', {
        body: {
          action: 'message',
          session_id: session.sessionId,
          message: content,
          language,
        },
      });

      if (fnError) throw fnError;

      // Add assistant response
      const assistantMessage: Message = {
        message_id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        language,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Update session state
      setSession(prev => prev ? {
        ...prev,
        phase: data.phase,
      } : null);

      // Handle red flags
      if (data.red_flags?.length > 0) {
        setRedFlags(prev => [...prev, ...data.red_flags]);
      }

      // Handle escalation
      if (data.escalated) {
        setIsEscalated(true);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove the user message on error
      setMessages(prev => prev.filter(m => m.message_id !== userMessage.message_id));
    } finally {
      setIsLoading(false);
    }
  }, [session?.sessionId, language]);

  // Complete/save session
  const completeSession = useCallback(async () => {
    if (!session?.sessionId) return false;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('helios-session', {
        body: {
          action: 'complete',
          session_id: session.sessionId,
        },
      });

      if (fnError) throw fnError;

      // Update session state to completed
      setSession(prev => prev ? {
        ...prev,
        phase: 'completed',
        triageLevel: data.triage_level || null,
        disposition: data.disposition || null,
      } : null);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete session');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [session?.sessionId]);

  // Reset session
  const resetSession = useCallback(() => {
    setSession(null);
    setMessages([]);
    setRedFlags([]);
    setIsEscalated(false);
    setError(null);
  }, []);

  return {
    session,
    messages,
    redFlags,
    isLoading,
    isEscalated,
    error,
    startSession,
    sendMessage,
    completeSession,
    resetSession,
  };
}
