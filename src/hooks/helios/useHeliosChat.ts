/**
 * HELIOS Chat Hook
 * Manages chat session with document upload and AI interaction
 * Uses Supabase Edge Functions for API communication
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { HealthVault } from '@/lib/helios/vault';
import type { Message, RedFlag, CaseState, SymptomEntity, Hypothesis } from '@/lib/helios/types';

interface UseHeliosChatOptions {
  language?: 'en' | 'es' | 'fr';
}

export function useHeliosChat(
  sessionId: string,
  vault: HealthVault | null,
  options: UseHeliosChatOptions = {}
) {
  const { language = 'en' } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [phase, setPhase] = useState<string>('intake');
  const [error, setError] = useState<string | null>(null);
  const [caseState, setCaseState] = useState<CaseState | null>(null);
  const [symptoms, setSymptoms] = useState<SymptomEntity[]>([]);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [chiefComplaint, setChiefComplaint] = useState<string | undefined>();
  const [demographics, setDemographics] = useState<{ age?: number; sex?: string } | undefined>();

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load existing session
  useEffect(() => {
    if (vault && sessionId) {
      loadSession();
    }
  }, [vault, sessionId]);

  const loadSession = async () => {
    if (!vault) return;

    try {
      const session = await vault.getConsult(sessionId);

      if (session) {
        setMessages(session.messages || []);
        setPhase(session.phase || 'intake');
        setRedFlags(session.redFlags || []);
        setIsEscalated(session.escalationTriggered || false);
      } else {
        // New session - add greeting
        const greeting = getGreeting(language);
        setMessages([{
          id: crypto.randomUUID(),
          role: 'assistant',
          content: greeting,
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      setError('Failed to load session');
    }
  };

  const sendMessage = useCallback(async (
    content: string,
    options?: { demographics?: { age: number; sex: string } }
  ) => {
    if (!content.trim()) return;

    setIsLoading(true);
    setError(null);

    // Store demographics if provided
    if (options?.demographics) {
      setDemographics(options.demographics);
    }

    // Set chief complaint from first message
    if (!chiefComplaint && messages.length <= 1) {
      setChiefComplaint(content);
    }

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      // Call HELIOS via Supabase Edge Function
      const { data, error: fnError } = await supabase.functions.invoke('helios-session', {
        body: {
          action: 'message',
          session_id: sessionId,
          message: content,
          language,
          demographics: options?.demographics,
        },
      });

      if (fnError) {
        throw fnError;
      }

      // Add AI response
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        redFlags: data.red_flags,
      };

      const updatedMessages = [...messages, userMessage, aiMessage];
      setMessages(prev => [...prev, aiMessage]);
      setPhase(data.phase || 'intake');

      // Update symptoms and hypotheses
      const updatedSymptoms = data.symptoms || symptoms;
      const updatedHypotheses = data.hypotheses || hypotheses;
      setSymptoms(updatedSymptoms);
      setHypotheses(updatedHypotheses);

      // Handle red flags and escalation
      if (data.red_flags?.length > 0) {
        setRedFlags(prev => [...prev, ...data.red_flags]);
      }

      if (data.escalated) {
        setIsEscalated(true);
      }

      // Build and update CaseState
      const newCaseState: CaseState = {
        session_id: sessionId,
        phase: data.phase || 'intake',
        chief_complaint: chiefComplaint || content,
        demographics: demographics || options?.demographics,
        symptom_entities: updatedSymptoms,
        hypothesis_list: updatedHypotheses,
        red_flags: data.red_flags || redFlags,
        triage_level: data.triage_level,
        disposition: data.disposition,
        messages: updatedMessages,
        created_at: caseState?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setCaseState(newCaseState);

      // Save to vault
      if (vault) {
        await vault.saveConsult({
          id: sessionId,
          messages: updatedMessages,
          symptoms: updatedSymptoms,
          hypotheses: updatedHypotheses,
          redFlags: data.red_flags || [],
          language,
          phase: data.phase,
          triageLevel: data.triage_level,
        });
      }
    } catch (err) {
      console.error('HELIOS sendMessage error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove the optimistically added user message
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, language, vault, messages, chiefComplaint, demographics, symptoms, hypotheses, redFlags, caseState]);

  const uploadDocument = useCallback(async (file: File) => {
    if (!vault) return;

    setIsLoading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();

      // Determine document type
      let type: 'lab_result' | 'imaging' | 'prescription' | 'photo' | 'other' = 'other';
      if (file.type.startsWith('image/')) {
        type = 'photo';
      } else if (file.name.toLowerCase().includes('lab') || file.name.toLowerCase().includes('result')) {
        type = 'lab_result';
      } else if (file.name.toLowerCase().includes('rx') || file.name.toLowerCase().includes('prescription')) {
        type = 'prescription';
      }

      // Save to vault
      const docId = crypto.randomUUID();
      await vault.saveDocument({
        id: docId,
        consultId: sessionId,
        type,
        filename: file.name,
        mimeType: file.type,
        data: arrayBuffer,
      });

      // Add system message about upload
      const uploadMessage: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Document uploaded: ${file.name}`,
        timestamp: new Date().toISOString(),
        attachments: [{
          id: docId,
          type: file.type.startsWith('image/') ? 'image' : 'document',
          filename: file.name,
        }],
      };

      setMessages(prev => [...prev, uploadMessage]);

      // If it's an image, we could analyze it
      if (file.type.startsWith('image/')) {
        // In production, could send to vision model for analysis
        // For now, just acknowledge
        await sendMessage(`I've uploaded an image: ${file.name}. Please analyze it.`);
      }
    } catch (err) {
      setError('Failed to upload document');
    } finally {
      setIsLoading(false);
    }
  }, [vault, sessionId, sendMessage]);

  const cancelRequest = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    isEscalated,
    redFlags,
    phase,
    caseState,
    error,
    sendMessage,
    uploadDocument,
    cancelRequest,
  };
}

function getGreeting(language: string): string {
  const greetings: Record<string, string> = {
    en: "Hello! I'm your AI health assistant. I'll help gather information about your symptoms to connect you with the right care. This is not a substitute for professional medical advice. What brings you in today?",
    es: "¡Hola! Soy tu asistente de salud con IA. Te ayudaré a recopilar información sobre tus síntomas para conectarte con la atención adecuada. Esto no sustituye el consejo médico profesional. ¿Qué te trae hoy?",
    fr: "Bonjour! Je suis votre assistant de santé IA. Je vais vous aider à recueillir des informations sur vos symptômes pour vous orienter vers les soins appropriés. Ceci ne remplace pas les conseils médicaux professionnels. Qu'est-ce qui vous amène aujourd'hui?",
  };
  return greetings[language] || greetings.en;
}
