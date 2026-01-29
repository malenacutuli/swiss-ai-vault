// src/hooks/helios/useHeliosChat.ts
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message, RedFlag } from '@/lib/helios/types';

interface CaseState {
  session_id: string;
  phase: string;
  specialty: string;
  patient_info: {
    age?: number;
    sex?: 'male' | 'female';
  };
}

interface UseHeliosChatReturn {
  messages: Message[];
  isLoading: boolean;
  isEscalated: boolean;
  redFlags: RedFlag[];
  phase: string;
  caseState: CaseState | null;
  intakeRequired: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  submitIntake: (age: number, sex: 'male' | 'female') => Promise<void>;
  startSession: (specialty?: string) => Promise<void>;
}

export function useHeliosChat(initialSpecialty?: string): UseHeliosChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [phase, setPhase] = useState('intake');
  const [caseState, setCaseState] = useState<CaseState | null>(null);
  const [intakeRequired, setIntakeRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);

  // Start a new session
  const startSession = useCallback(async (specialty?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[HELIOS] Creating session with specialty:', specialty || initialSpecialty || 'primary-care');

      const { data, error: fnError } = await supabase.functions.invoke('helios-chat', {
        body: {
          action: 'create',
          specialty: specialty || initialSpecialty || 'primary-care',
          language: 'en',
        },
      });

      console.log('[HELIOS] Create response:', { data, fnError });

      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');

      sessionIdRef.current = data.session_id;

      setCaseState({
        session_id: data.session_id,
        phase: data.phase,
        specialty: specialty || initialSpecialty || 'primary-care',
        patient_info: {},
      });

      setPhase(data.phase);

      // Add greeting message
      setMessages([{
        message_id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        language: 'en',
        timestamp: new Date().toISOString(),
      }]);

    } catch (err) {
      console.error('Failed to start HELIOS session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      // Fallback greeting
      setMessages([{
        message_id: crypto.randomUUID(),
        role: 'assistant',
        content: "Hello! I'm your AI health assistant. I'll help gather information about your symptoms to connect you with the right care. This is not a substitute for professional medical advice. What brings you in today?",
        language: 'en',
        timestamp: new Date().toISOString(),
      }]);
      sessionIdRef.current = crypto.randomUUID();
      setCaseState({
        session_id: sessionIdRef.current,
        phase: 'intake',
        specialty: specialty || 'primary-care',
        patient_info: {},
      });
    } finally {
      setIsLoading(false);
    }
  }, [initialSpecialty]);

  // Send a message
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setError(null);

    // Add user message immediately
    const userMessage: Message = {
      message_id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      language: 'en',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      console.log('[HELIOS] Sending message to session:', sessionIdRef.current);

      const { data, error: fnError } = await supabase.functions.invoke('helios-chat', {
        body: {
          action: 'message',
          session_id: sessionIdRef.current,
          message: content.trim(),
          patient_info: caseState?.patient_info,
        },
      });

      console.log('[HELIOS] Response:', { data, fnError });

      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');

      // Update state from response
      setPhase(data.phase);
      setIntakeRequired(data.intake_required || false);

      if (data.red_flags?.length > 0) {
        setRedFlags(prev => [...prev, ...data.red_flags]);
      }

      if (data.escalated) {
        setIsEscalated(true);
      }

      // Add assistant message
      const assistantMessage: Message = {
        message_id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        language: 'en',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Update caseState with response data
      setCaseState(prev => prev ? {
        ...prev,
        phase: data.phase,
        ...(data.caseState || {}),
      } : null);

    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Add error message
      setMessages(prev => [...prev, {
        message_id: crypto.randomUUID(),
        role: 'assistant',
        content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
        language: 'en',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [caseState]);

  // Submit intake information
  const submitIntake = useCallback(async (age: number, sex: 'male' | 'female') => {
    setCaseState(prev => prev ? {
      ...prev,
      patient_info: { age, sex },
    } : null);

    setIntakeRequired(false);
    setError(null);

    // Send intake action to update session
    setIsLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('helios-chat', {
        body: {
          action: 'intake',
          session_id: sessionIdRef.current,
          patient_info: { age, sex },
          language: 'en',
        },
      });

      if (fnError) throw fnError;

      setPhase(data.phase);

      // Add the AI response
      const assistantMessage: Message = {
        message_id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        language: 'en',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error('Failed to submit intake:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit intake');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    messages,
    isLoading,
    isEscalated,
    redFlags,
    phase,
    caseState,
    intakeRequired,
    error,
    sendMessage,
    submitIntake,
    startSession,
  };
}
