// src/hooks/helios/useHeliosChat.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as mainSupabase } from '@/integrations/supabase/client';
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

interface UITriggers {
  showAssessment: boolean;
  showBooking: boolean;
  showEmergency: boolean;
  showSummary: boolean;
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
  sessionId: string | null;
  uiTriggers: UITriggers;
  soapNote: string | null;
  sendMessage: (content: string, language?: string) => Promise<void>;
  submitIntake: (age: number, sex: 'male' | 'female') => Promise<void>;
  startSession: (specialty?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<boolean>;
  completeSession: () => Promise<{ success: boolean; summary?: string; soap_note?: string }>;
  createBooking: (bookingData: { scheduledAt: string; specialty: string; includeSOAPNote: boolean; paymentMethod: string }) => Promise<{ success: boolean; booking_id?: string }>;
}

export function useHeliosChat(initialSpecialty?: string, initialLanguage: 'en' | 'es' | 'fr' = 'en'): UseHeliosChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [phase, setPhase] = useState('intake');
  const [caseState, setCaseState] = useState<CaseState | null>(null);
  const [intakeRequired, setIntakeRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uiTriggers, setUITriggers] = useState<UITriggers>({
    showAssessment: false,
    showBooking: false,
    showEmergency: false,
    showSummary: false,
  });
  const [soapNote, setSoapNote] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);

  // Get user ID from main Supabase auth for persistence
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await mainSupabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, []);

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
          user_id: userId, // Pass user_id for persistence
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
  }, [initialSpecialty, userId]);

  // Send a message
  const sendMessage = useCallback(async (content: string, language: string = 'en') => {
    if (!content.trim()) return;

    setError(null);

    // Add user message immediately
    const userMessage: Message = {
      message_id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      language: (language === 'en' || language === 'es' || language === 'fr') ? language : 'en',
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
          language: language,
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

      // Update UI triggers
      if (data.ui_triggers) {
        setUITriggers(data.ui_triggers);
      }

      // Update SOAP note if available
      if (data.soap_note) {
        setSoapNote(data.soap_note);
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

  // Load an existing session
  const loadSession = useCallback(async (sessionId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[HELIOS] Loading session:', sessionId);

      const { data, error: fnError } = await supabase.functions.invoke('helios-chat', {
        body: {
          action: 'get',
          session_id: sessionId,
        },
      });

      console.log('[HELIOS] Load session response:', { data, fnError });

      if (fnError) throw fnError;
      if (!data?.success) {
        console.log('[HELIOS] Session not found, will create new');
        return false;
      }

      sessionIdRef.current = data.session_id;
      setPhase(data.phase || 'intake');
      setIsEscalated(data.escalated || false);
      setRedFlags(data.red_flags || []);

      // Convert stored messages to Message format
      const loadedMessages: Message[] = (data.messages || []).map((m: any) => ({
        message_id: m.message_id || crypto.randomUUID(),
        role: m.role,
        content: m.content,
        language: m.language || 'en',
        timestamp: m.timestamp || new Date().toISOString(),
      }));

      setMessages(loadedMessages);

      setCaseState({
        session_id: data.session_id,
        phase: data.phase || 'intake',
        specialty: data.specialty || 'primary-care',
        patient_info: data.patient_info || {},
      });

      // Update UI triggers from loaded session
      if (data.ui_triggers) {
        setUITriggers(data.ui_triggers);
      }

      // Update SOAP note if available
      if (data.soap_note) {
        setSoapNote(data.soap_note);
      }

      return true;
    } catch (err) {
      console.error('Failed to load session:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Complete a session (marks it as completed in Supabase)
  const completeSession = useCallback(async (): Promise<{ success: boolean; summary?: string }> => {
    if (!sessionIdRef.current) {
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[HELIOS] Completing session:', sessionIdRef.current);

      const { data, error: fnError } = await supabase.functions.invoke('helios-chat', {
        body: {
          action: 'complete_session',
          session_id: sessionIdRef.current,
        },
      });

      console.log('[HELIOS] Complete session response:', { data, fnError });

      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || 'Failed to complete session');

      setPhase('completed');

      // Update SOAP note
      if (data.soap_note) {
        setSoapNote(data.soap_note);
      }

      return {
        success: true,
        summary: data.summary,
      };
    } catch (err) {
      console.error('Failed to complete session:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete session');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a booking linked to this session
  const createBooking = useCallback(async (bookingData: {
    scheduledAt: string;
    specialty: string;
    includeSOAPNote: boolean;
    paymentMethod: string;
  }): Promise<{ success: boolean; booking_id?: string }> => {
    if (!sessionIdRef.current) {
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[HELIOS] Creating booking for session:', sessionIdRef.current);

      const { data, error: fnError } = await supabase.functions.invoke('helios-chat', {
        body: {
          action: 'create_booking',
          session_id: sessionIdRef.current,
          user_id: userId,
          booking: {
            scheduled_at: bookingData.scheduledAt,
            specialty: bookingData.specialty,
            include_soap_note: bookingData.includeSOAPNote,
            payment_method: bookingData.paymentMethod,
          },
        },
      });

      console.log('[HELIOS] Create booking response:', { data, fnError });

      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || 'Failed to create booking');

      return {
        success: true,
        booking_id: data.booking_id,
      };
    } catch (err) {
      console.error('Failed to create booking:', err);
      setError(err instanceof Error ? err.message : 'Failed to create booking');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return {
    messages,
    isLoading,
    isEscalated,
    redFlags,
    phase,
    caseState,
    intakeRequired,
    error,
    sessionId: sessionIdRef.current,
    uiTriggers,
    soapNote,
    sendMessage,
    submitIntake,
    startSession,
    loadSession,
    completeSession,
    createBooking,
  };
}
